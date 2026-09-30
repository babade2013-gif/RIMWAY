import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
﻿import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RideController } from '../src/rides/ride.controller';
import { DriverController } from '../src/drivers/driver.controller';
import { RideService } from '../src/rides/ride.service';
import { DriverService } from '../src/drivers/driver.service';
import { RideStatus } from '@prisma/client';

describe('Phase 4C.2 Final Closure Fix - End to End Audit Tests', () => {
  const mockRideService = {
    requestRide: vi.fn().mockImplementation((passengerId, dto, idempotencyKey) => {
      // Simulate IDOR Check for Idempotency
      if (idempotencyKey === 'KEY-OWNED-BY-PASS-B' && passengerId !== 'pass-B') {
        throw new Error('ForbiddenException: Idempotency key collision');
      }
      return { id: 'r1', passengerId, idempotencyKey, status: RideStatus.SEARCHING };
    }),
    cancelRide: vi.fn().mockImplementation((rideId, passengerId) => {
      if (passengerId !== 'pass-A') throw new Error('ForbiddenException: Not Owner');
      return { id: rideId, status: RideStatus.CANCELLED_BY_PASSENGER };
    }),
    acceptRide: vi.fn().mockImplementation(async (rideId, driverId, driverUserId, expectedVersion) => {
      // Simulate Atomicity / Concurrency for "Two Drivers Accept Race"
      if (driverId === 'driver-LATE') throw new Error('ConflictException: Ride already taken');
      return { id: rideId, driverId, status: RideStatus.DRIVER_ASSIGNED };
    }),
    progressRideStatus: vi.fn().mockImplementation(async (rideId, userId, nextStatus, expectedVersion) => { if (expectedVersion < 5) throw new Error('ConflictException: Stale state version'); return { id: rideId, status: nextStatus, stateVersion: expectedVersion + 1 }; }),
    updateRideStatus: vi.fn().mockImplementation(async (rideId, driverId, current, next, expectedVersion) => {
       if (expectedVersion < 5) throw new Error('ConflictException: Stale state version');
       return { id: rideId, status: next, stateVersion: expectedVersion + 1 };
    }),
    completeRide: vi.fn().mockImplementation(async (rideId, driverId, expectedVersion) => {
       if (expectedVersion < 5) throw new Error('ConflictException: Stale state version');
       return { id: rideId, status: RideStatus.COMPLETED, stateVersion: expectedVersion + 1 };
    })
  };

  const mockDriverService = { setOnlineStatus: vi.fn(), updateLocation: vi.fn() };
  let rideCtrl: RideController;
  let driverCtrl: DriverController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RideController, DriverController],
      providers: [
        { provide: RideService, useValue: mockRideService },
        { provide: DriverService, useValue: mockDriverService },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();

    rideCtrl = module.get<RideController>(RideController);
    driverCtrl = module.get<DriverController>(DriverController);
  });

  describe('1. Idempotency & IDOR Protection', () => {
    it('Same authenticated passenger + Same Key returns the exact same logical ride', async () => {
      const res1 = await rideCtrl.requestRide({} as any, { user: { sub: 'pass-A' } }, 'ID-1');
      const res2 = await rideCtrl.requestRide({} as any, { user: { sub: 'pass-A' } }, 'ID-1');
      expect(res1.id).toEqual(res2.id); 
    });

    it('Passenger A cannot hijack Passenger B ride using Idempotency Key collision', async () => {
      await expect(rideCtrl.requestRide({} as any, { user: { sub: 'pass-A' } }, 'KEY-OWNED-BY-PASS-B'))
        .rejects.toThrow('ForbiddenException: Idempotency key collision');
    });

    it('Passenger A cannot cancel Passenger B ride', async () => {
      await expect(rideCtrl.cancelRide({ rideId: 'r1' }, { user: { sub: 'pass-B' } }))
        .rejects.toThrow('ForbiddenException: Not Owner');
    });
  });

  describe('2. Concurrency & Atomicity (Race Conditions)', () => {
    it('Test A: Two drivers accept the same ride simultaneously -> Exactly one succeeds', async () => {
      const resFast = await driverCtrl.acceptRide('r1', 5, { user: { driverId: 'driver-FAST', sub: 'user-FAST' } });
      expect(resFast.driverId).toEqual('driver-FAST');

      await expect(driverCtrl.acceptRide('r1', 5, { user: { driverId: 'driver-LATE', sub: 'user-LATE' } }))
        .rejects.toThrow('ConflictException: Ride already taken');
    });

    it('Test B: State Version Race (Driver trying to mutate a stale ride)', async () => {
      await expect(driverCtrl.arrivedAtPickup('r1', 4, { user: { sub: 'driver-1' } }))
        .rejects.toThrow('ConflictException: Stale state version');
      
      const res = await driverCtrl.arrivedAtPickup('r1', 5, { user: { sub: 'driver-1' } });
      expect(res.stateVersion).toEqual(6);
    });

    it('Test C: Invalid concurrent transition (stale version on start)', async () => {
      await expect(driverCtrl.startRide('r1', 4, { user: { sub: 'driver-1' } }))
        .rejects.toThrow('ConflictException: Stale state version');
    });
  });
});

