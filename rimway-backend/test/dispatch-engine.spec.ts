import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverService } from '../src/drivers/driver.service';
import { RideService } from '../src/rides/ride.service';
import { RideTimeoutService } from '../src/rides/ride-timeout.service';
import { RideStatus } from '@prisma/client';

describe('Phase 6B Dispatch Engine', () => {
  let driverService: DriverService;
  let rideService: RideService;
  let timeoutService: RideTimeoutService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockGateway: any;

  beforeEach(() => {
    mockRedis = {
      geosearch: vi.fn(),
      exists: vi.fn(),
      set: vi.fn(),
      hset: vi.fn(),
      hgetall: vi.fn(),
      eval: vi.fn(),
      geoadd: vi.fn(),
      zrem: vi.fn()
    };
    mockPrisma = {
      driver: { findUnique: vi.fn().mockResolvedValue({ status: 'APPROVED', isOnline: true }), update: vi.fn() },
      ride: { 
        findFirst: vi.fn(), 
        findMany: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn()
      },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
      auditLog: { create: vi.fn() }
    };
    mockGateway = { server: { to: vi.fn(() => ({ emit: vi.fn() })) }, emitRideStatusChanged: vi.fn() };
    
    driverService = new DriverService(mockPrisma);
    // @ts-ignore
    driverService.redis = mockRedis; 

    rideService = new RideService(mockPrisma, {} as any, {} as any, mockGateway, driverService);
    timeoutService = new RideTimeoutService(mockPrisma, mockGateway, rideService, driverService);
  });

  it('radius filtering and nearby selection (1 & 2)', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2']);
    mockRedis.exists.mockResolvedValue(1); // fresh
    mockPrisma.ride.findFirst.mockResolvedValue(null); // no active ride
    mockRedis.set.mockResolvedValue(1); // nx succeeded

    const eligible = await driverService.findNearbyEligibleDrivers(1, 1, 5, 'r1', 1, 5);
    expect(mockRedis.geosearch).toHaveBeenCalledWith('drivers:location', 'FROMLONLAT', 1, 1, 'BYRADIUS', 5, 'km', 'ASC');
    expect(eligible).toEqual(['d1', 'd2']);
  });

  it('stale, offline, active-ride exclusion (3, 4, 5)', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2', 'd3']);
    mockRedis.exists.mockImplementation((k: string) => Promise.resolve(k.includes('d1') ? 0 : 1));
    mockPrisma.ride.findFirst.mockImplementation((query: any) => Promise.resolve(query.where.driverId === 'd2' ? { id: 'active' } : null));
    mockRedis.set.mockResolvedValue(1); 

    const eligible = await driverService.findNearbyEligibleDrivers(1, 1, 5, 'r1', 1, 5);
    expect(eligible).toEqual(['d3']);
  });

  it('Top N selection (6)', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
    mockRedis.exists.mockResolvedValue(1);
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    const eligible = await driverService.findNearbyEligibleDrivers(1, 1, 5, 'r1', 1, 3);
    expect(eligible.length).toBe(3);
    expect(eligible).toEqual(['d1', 'd2', 'd3']);
  });

  it('Redis duplicate prevention within same cycle (8)', async () => {
    mockRedis.geosearch.mockResolvedValue(['d1', 'd2']);
    mockRedis.exists.mockResolvedValue(1);
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockImplementation((k: string) => {
      if (k.includes('d1')) return Promise.resolve(0); // already dispatched
      return Promise.resolve(1);
    });

    const eligible = await driverService.findNearbyEligibleDrivers(1, 1, 5, 'r1', 1, 5);
    expect(eligible).toEqual(['d2']);
  });

  it('cycle increment, expansion, parallel broadcast (7, 9, 10, 11)', async () => {
    mockPrisma.ride.findMany.mockResolvedValue([{ id: 'r1', stateVersion: 1, pickupLat: 1, pickupLng: 1 }]);
    mockRedis.hgetall.mockResolvedValue({ cycle: '1', expiresAt: (Date.now() - 1000).toString() });
    mockRedis.eval.mockResolvedValue(1); // advance success
    mockRedis.geosearch.mockResolvedValue(['d1']);
    mockRedis.exists.mockResolvedValue(1);
    mockPrisma.ride.findFirst.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(1);

    await timeoutService.handleRideTimeouts();
    expect(mockRedis.eval).toHaveBeenCalled();
    // Radius should be 5 + (2 - 1) * 5 = 10km
    expect(mockRedis.geosearch).toHaveBeenCalledWith('drivers:location', 'FROMLONLAT', 1, 1, 'BYRADIUS', 10, 'km', 'ASC');
  });

  it('max cycles leads to NO_DRIVER_FOUND (12)', async () => {
    mockPrisma.ride.findMany.mockResolvedValue([{ id: 'r1', stateVersion: 1 }]);
    mockRedis.hgetall.mockResolvedValue({ cycle: '3', expiresAt: (Date.now() - 1000).toString() });
    
    mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.ride.findUnique.mockResolvedValue({ id: 'r1', stateVersion: 2, status: 'NO_DRIVER_FOUND' });

    await timeoutService.handleRideTimeouts();

    expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'r1', status: 'SEARCHING', stateVersion: 1 },
      data: { status: 'NO_DRIVER_FOUND', stateVersion: { increment: 1 } }
    }));
  });

  it('accept vs cycle expiry race', async () => {
    let rideState = { status: RideStatus.SEARCHING, stateVersion: 1 };
    mockPrisma.ride.updateMany.mockImplementation(async (query: any) => {
      if (query.where.status === rideState.status && query.where.stateVersion === rideState.stateVersion) {
        rideState.status = query.data.status;
        rideState.stateVersion++;
        return { count: 1 };
      }
      return { count: 0 };
    });
    mockPrisma.ride.findUnique.mockImplementation(() => Promise.resolve(rideState));
    mockPrisma.ride.findMany.mockResolvedValue([{ id: 'r1', stateVersion: 1 }]);
    mockRedis.hgetall.mockResolvedValue({ cycle: '3', expiresAt: (Date.now() - 1000).toString() });
    
    // Captain accepts
    await rideService.acceptRide('r1', 'd1', 'user1', 1);
    expect(rideState.status).toBe(RideStatus.DRIVER_ASSIGNED);
    
    // Concurrently, timeout tries to fail the ride
    await timeoutService.handleRideTimeouts();
    
    // Must remain DRIVER_ASSIGNED
    expect(rideState.status).toBe(RideStatus.DRIVER_ASSIGNED);
    expect(rideState.status).not.toBe(RideStatus.NO_DRIVER_FOUND);
  });

  it('duplicate cycle advance prevention', async () => {
    mockPrisma.ride.findMany.mockResolvedValue([{ id: 'r1', stateVersion: 1, pickupLat: 1, pickupLng: 1 }]);
    mockRedis.hgetall.mockResolvedValue({ cycle: '1', expiresAt: (Date.now() - 1000).toString() });
    
    let redisCycle = 1;
    mockRedis.eval.mockImplementation((script: string, num: number, key: string, expectedCycle: number) => {
      if (redisCycle === expectedCycle) {
        redisCycle++;
        return Promise.resolve(1); // SUCCESS
      }
      return Promise.resolve(0); // FAILED
    });

    const dispatchSpy = vi.spyOn(rideService, 'dispatchCycle').mockResolvedValue(undefined);

    await Promise.all([
      timeoutService.handleRideTimeouts(),
      timeoutService.handleRideTimeouts()
    ]);

    expect(redisCycle).toBe(2); // strictly advanced once
    expect(dispatchSpy).toHaveBeenCalledTimes(1); // broadcast triggered exactly once
    expect(dispatchSpy).toHaveBeenCalledWith('r1', 2, 1, 1);
  });

  it('cancellation vs dispatch race', async () => {
    // Provide a mocked state machine for cancellation
    const mockStateMachine = { validateTransitionOrThrow: vi.fn() };
    const tempRideService = new RideService(mockPrisma, mockStateMachine as any, {} as any, mockGateway, driverService);
    
    let rideState = { id: 'r1', passengerId: 'p1', status: RideStatus.SEARCHING, stateVersion: 1 };
    mockPrisma.ride.updateMany.mockImplementation(async (query: any) => {
      if (query.where.status === rideState.status && query.where.stateVersion === rideState.stateVersion) {
        rideState.status = query.data.status;
        rideState.stateVersion++;
        return { count: 1 };
      }
      return { count: 0 };
    });
    mockPrisma.ride.findUnique.mockImplementation(() => Promise.resolve(rideState));
    
    // Passenger cancels
    await tempRideService.cancelRide('r1', 'p1');
    expect(rideState.status).toBe(RideStatus.CANCELLED_BY_PASSENGER);
    
    // Timeout worker runs with stale 'SEARCHING' data
    mockPrisma.ride.findMany.mockResolvedValue([{ id: 'r1', stateVersion: 1 }]);
    mockRedis.hgetall.mockResolvedValue({ cycle: '3', expiresAt: (Date.now() - 1000).toString() });
    
    const timeoutServiceWithTempRideService = new RideTimeoutService(mockPrisma, mockGateway, tempRideService, driverService);
    await timeoutServiceWithTempRideService.handleRideTimeouts();
    
    // Must remain CANCELLED, dispatch does not resurrect it
    expect(rideState.status).toBe(RideStatus.CANCELLED_BY_PASSENGER);
  });
});
