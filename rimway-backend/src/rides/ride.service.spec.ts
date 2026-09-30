import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RideService } from './ride.service';
import { RideStateMachine } from './ride-state.machine';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { RideGateway } from '../events/ride.gateway';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { ConflictException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

import { DriverService } from '../drivers/driver.service';
import { WalletService } from '../wallet/wallet.service';

describe('RideService Concurrency', () => {
  let rideService: RideService;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RideService,
        RideStateMachine,
        { provide: PricingService, useValue: {} },
        { provide: RideGateway, useValue: { emitRideStatusChanged: vi.fn(), server: { to: vi.fn(() => ({ emit: vi.fn() })) } } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: DriverService, useValue: { findNearbyEligibleDrivers: vi.fn().mockResolvedValue([]), redisClient: { hset: vi.fn() } } },
        { provide: WalletService, useValue: {} },
      ],
    }).compile();

    rideService = module.get<RideService>(RideService);
  });

  it('should allow only one driver to accept the ride (prevent duplicate assignment)', async () => {
    prismaMock.ride.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });

    prismaMock.ride.findUnique.mockResolvedValue({ id: 'ride-1', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 2 } as any);
    prismaMock.auditLog.create.mockResolvedValue({} as any);

    const attempts = Array.from({ length: 5 }).map((_, i) => rideService.acceptRide('ride-1', `driver-${i}`, `user-${i}`, 1));
    const results = await Promise.allSettled(attempts);

    const successes = results.filter(r => r.status === 'fulfilled');
    const conflicts = results.filter(r => r.status === 'rejected' && r.reason instanceof ConflictException);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);
  });
});
