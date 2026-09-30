import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RideService } from '../src/rides/ride.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RideStateMachine } from '../src/rides/ride-state.machine';
import { PricingService } from '../src/pricing/pricing.service';
import { RideGateway } from '../src/events/ride.gateway';
import { DriverService } from '../src/drivers/driver.service';
import { WalletService } from '../src/wallet/wallet.service';
import { RideStatus, Prisma } from '@prisma/client';
import { ForbiddenException, ConflictException } from '@nestjs/common';

describe('Captain Endpoints - Current Ride Recovery and Cancellation', () => {
  let rideService: RideService;
  
  const mockPrisma = {
    driver: {
      findUnique: vi.fn(),
    },
    ride: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 're-dispatched-ride-1', pickupLat: 18.0, pickupLng: -15.0 }),
    },
    $transaction: vi.fn(async (cb) => {
      return cb(mockPrisma);
    }),
    auditLog: {
      create: vi.fn(),
    }
  };

  const mockStateMachine = {
    validateTransitionOrThrow: vi.fn(),
  };

  const mockGateway = {
    emitRideStatusChanged: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RideService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RideStateMachine, useValue: mockStateMachine },
        { provide: PricingService, useValue: {} },
        { provide: RideGateway, useValue: mockGateway },
        { provide: DriverService, useValue: {} },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    rideService = module.get<RideService>(RideService);
    vi.spyOn(rideService, 'dispatchCycle').mockResolvedValue(undefined as any);
    vi.clearAllMocks();
  });

  describe('Current Ride Recovery', () => {
    it('active ride returned successfully', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1', userId: 'user-1' });
      mockPrisma.ride.findFirst.mockResolvedValue({ id: 'ride-1', status: RideStatus.DRIVER_ASSIGNED });
      
      const result = await rideService.getDriverCurrentRide('user-1');
      expect(result.id).toEqual('ride-1');
      expect(mockPrisma.ride.findFirst).toHaveBeenCalledWith({
        where: {
          driverId: 'driver-1',
          status: {
            in: [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, RideStatus.PASSENGER_BOARDED, RideStatus.IN_PROGRESS]
          }
        }
      });
    });

    it('no active ride returns NO_RIDE_FOUND', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1', userId: 'user-1' });
      mockPrisma.ride.findFirst.mockResolvedValue(null);
      
      const result = await rideService.getDriverCurrentRide('user-1');
      expect(result).toEqual({ status: 'NO_RIDE_FOUND' });
    });

    it('ownership enforced - wrong driver / IDOR throws ForbiddenException', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);
      await expect(rideService.getDriverCurrentRide('wrong-user'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('Captain Cancel', () => {
    it('DRIVER_ASSIGNED succeeds', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 5 });
      mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
      
      const result = await rideService.cancelRideByDriver('ride-1', 'user-1', 5);
      expect(mockPrisma.ride.updateMany).toHaveBeenCalledWith({
        where: { id: 'ride-1', driverId: 'driver-1', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 5 },
        data: expect.any(Object)
      });
      expect(mockGateway.emitRideStatusChanged).toHaveBeenCalled();
    });

    it('DRIVER_ARRIVED succeeds', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.DRIVER_ARRIVED, stateVersion: 5 });
      mockPrisma.ride.updateMany.mockResolvedValue({ count: 1 });
      
      await rideService.cancelRideByDriver('ride-1', 'user-1', 5);
      expect(mockPrisma.ride.updateMany).toHaveBeenCalled();
    });

    it('PASSENGER_BOARDED rejected with 409 Conflict', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.PASSENGER_BOARDED, stateVersion: 5 });
      
      await expect(rideService.cancelRideByDriver('ride-1', 'user-1', 5))
        .rejects.toThrow(ConflictException);
    });

    it('IN_PROGRESS rejected with 409 Conflict', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.IN_PROGRESS, stateVersion: 5 });
      
      await expect(rideService.cancelRideByDriver('ride-1', 'user-1', 5))
        .rejects.toThrow(ConflictException);
    });

    it('COMPLETED rejected with 409 Conflict', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.COMPLETED, stateVersion: 5 });
      
      await expect(rideService.cancelRideByDriver('ride-1', 'user-1', 5))
        .rejects.toThrow(ConflictException);
    });

    it('wrong driver rejected (ForbiddenException)', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-OTHER', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 5 });
      
      await expect(rideService.cancelRideByDriver('ride-1', 'user-1', 5))
        .rejects.toThrow(ForbiddenException);
    });

    it('duplicate/concurrent cancellation or stateVersion race results in 409 Conflict', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
      mockPrisma.ride.findUnique.mockResolvedValue({ id: 'ride-1', driverId: 'driver-1', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 5 });
      // updateMany returns count 0 to simulate race condition where stateVersion was already incremented
      mockPrisma.ride.updateMany.mockResolvedValue({ count: 0 });
      
      await expect(rideService.cancelRideByDriver('ride-1', 'user-1', 5))
        .rejects.toThrow(ConflictException);
    });
  });
});
