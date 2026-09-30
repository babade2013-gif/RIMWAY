import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RideService } from '../src/rides/ride.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RideStateMachine } from '../src/rides/ride-state.machine';
import { PricingService } from '../src/pricing/pricing.service';
import { RideGateway } from '../src/events/ride.gateway';
import { DriverService } from '../src/drivers/driver.service';
import { WalletService } from '../src/wallet/wallet.service';
import { RideStatus, Prisma, TransactionType } from '@prisma/client';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { mockDeep } from 'vitest-mock-extended';

// Helper: build a mock ride in IN_PROGRESS state with full snapshot fields
function buildInProgressRide(overrides: any = {}) {
  return {
    id: 'ride-1',
    passengerId: 'passenger-1',
    driverId: 'driver-1',
    serviceTypeId: 'svc-1',
    status: RideStatus.IN_PROGRESS,
    stateVersion: 5,
    distanceKm: new Prisma.Decimal(10),
    estimatedTime: 20,
    estimatedFare: new Prisma.Decimal(228),
    finalFare: null,
    snapBaseFare: new Prisma.Decimal(50),
    snapPerKm: new Prisma.Decimal(10),
    snapPerMin: new Prisma.Decimal(2),
    snapSurge: new Prisma.Decimal('1.20'),
    snapServiceFee: new Prisma.Decimal(10), // 10%
    snapMinFare: new Prisma.Decimal(100),
    pickupLat: 36.7, pickupLng: 3.05,
    dropoffLat: 36.8, dropoffLng: 3.1,
    pickupName: 'A', dropoffName: 'B',
    rideCode: '1234',
    ...overrides,
  };
}

describe('Phase 6C — Financial Settlement', () => {
  let rideService: RideService;
  let mockPrisma: any;
  let mockGateway: any;
  let walletService: WalletService;
  let stateMachine: RideStateMachine;
  let pricingService: PricingService;

  // Track all created wallet transactions and audit logs
  let createdWalletTxs: any[];
  let createdAuditLogs: any[];
  let driverUpdateCalls: any[];

  beforeEach(async () => {
    createdWalletTxs = [];
    createdAuditLogs = [];
    driverUpdateCalls = [];

    mockPrisma = mockDeep<PrismaService>();
    mockGateway = { server: { to: vi.fn().mockReturnThis(), emit: vi.fn() }, emitRideStatusChanged: vi.fn() };

    stateMachine = new RideStateMachine();
    pricingService = new PricingService();
    walletService = new WalletService();

    const mockDriverService = { redisClient: {}, findNearbyEligibleDrivers: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RideStateMachine, useValue: stateMachine },
        { provide: PricingService, useValue: pricingService },
        { provide: RideGateway, useValue: mockGateway },
        { provide: DriverService, useValue: mockDriverService },
        { provide: WalletService, useValue: walletService },
        RideService,
      ],
    }).compile();

    rideService = module.get(RideService);

    // Default driver lookup
    mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1', userId: 'user-1' });
  });

  // ============================================================
  // Helper: setup mock transaction that captures all writes
  // ============================================================
  function setupTransactionMock(ride: any) {
    const completedRide = { ...ride, status: RideStatus.COMPLETED, stateVersion: ride.stateVersion + 1, finalFare: new Prisma.Decimal(228) };

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const txProxy = {
        ride: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue(completedRide),
        },
        walletTransaction: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async (args: any) => {
            createdWalletTxs.push(args.data);
            return args.data;
          }),
        },
        driver: {
          findUnique: vi.fn().mockResolvedValue({ id: 'driver-1', walletBalance: new Prisma.Decimal(1000) }),
          update: vi.fn().mockImplementation(async (args: any) => {
            driverUpdateCalls.push(args);
            return { id: 'driver-1', walletBalance: args.data.walletBalance };
          }),
        },
        auditLog: {
          create: vi.fn().mockImplementation(async (args: any) => {
            createdAuditLogs.push(args.data);
            return args.data;
          }),
        },
      };
      return cb(txProxy);
    });
  }

  // ============================================================
  // A. Positive completion
  // ============================================================

  describe('A. Positive completion', () => {
    it('1. IN_PROGRESS ride completes successfully', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      const result = await rideService.completeRide('ride-1', 'user-1', 5);
      expect(result.status).toBe(RideStatus.COMPLETED);
    });

    it('2. finalFare is calculated correctly from snapshots and commission debited', async () => {
      // (50 + 10*10 + 20*2) * 1.20 = (50+100+40)*1.2 = 190*1.2 = 228
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // Verify through wallet transactions: fare=228, commission=22.80 debited from operating wallet
      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      expect(commTx).toBeDefined();
      expect(commTx.amount.toNumber()).toBe(22.8);
      expect(commTx.balanceBefore.toNumber()).toBe(1000);
      expect(commTx.balanceAfter.toNumber()).toBe(977.2);
    });

    it('3. snapMinFare is respected', async () => {
      // With very short distance: baseFare=10, 1km*10=10, 5min*2=10 => subtotal = (10+10+10)*1.0 = 30
      // But minFare = 100 => subtotal becomes 100
      const ride = buildInProgressRide({
        snapBaseFare: new Prisma.Decimal(10),
        snapPerKm: new Prisma.Decimal(10),
        snapPerMin: new Prisma.Decimal(2),
        snapSurge: new Prisma.Decimal(1),
        snapMinFare: new Prisma.Decimal(100),
        distanceKm: new Prisma.Decimal(1),
        estimatedTime: 5,
      });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // finalFare should be 100 (minFare), commission = 100*10/100 = 10
      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      expect(commTx.amount.toNumber()).toBe(10);
    });

    it('4. snapServiceFee determines commission', async () => {
      const ride = buildInProgressRide({ snapServiceFee: new Prisma.Decimal(25) }); // 25%
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // finalFare = 228, commission = 228*25/100 = 57
      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      expect(commTx.amount.toNumber()).toBe(57);
    });

    it('5. wallet decreases by commission amount (operating balance debit)', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // finalFare=228, commission=22.80, wallet debited: 1000 - 22.80 = 977.20
      expect(driverUpdateCalls).toHaveLength(1);
      expect(driverUpdateCalls[0].data.walletBalance.toNumber()).toBe(977.2);
    });

    it('6. ledger records are linked to rideId with balanceBefore and balanceAfter', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      expect(createdWalletTxs).toHaveLength(1);
      const tx = createdWalletTxs[0];
      expect(tx.rideId).toBe('ride-1');
      expect(tx.driverId).toBe('driver-1');
      expect(tx.type).toBe(TransactionType.COMMISSION);
      expect(tx.balanceBefore.toNumber()).toBe(1000);
      expect(tx.balanceAfter.toNumber()).toBe(977.2);
    });

    it('7. financial AuditLog is created', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      expect(createdAuditLogs).toHaveLength(1);
      const log = createdAuditLogs[0];
      expect(log.action).toBe('RIDE_COMPLETED');
      expect(log.entity).toBe('Ride');
      expect(log.entityId).toBe('ride-1');
      expect(log.newData.finalFare).toBeDefined();
      expect(log.newData.commissionAmount).toBeDefined();
      expect(log.newData.netEarnings).toBeDefined();
      expect(log.newData.driverId).toBe('driver-1');
      expect(log.reason).toContain('Settlement');
    });
  });

  // ============================================================
  // B. Duplicate / concurrency
  // ============================================================

  describe('B. Duplicate / concurrency', () => {
    it('8. duplicate completion is rejected', async () => {
      const ride = buildInProgressRide({ status: RideStatus.COMPLETED, stateVersion: 6 });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);

      // State machine rejects COMPLETED -> COMPLETED
      await expect(rideService.completeRide('ride-1', 'user-1', 6))
        .rejects.toThrow(BadRequestException);
    });

    it('9. concurrent completion race — exactly one succeeds', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);

      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        callCount++;
        const txProxy = {
          ride: {
            updateMany: vi.fn().mockImplementation(async () => {
              // First call wins, second call fails stateVersion check
              if (callCount > 1) return { count: 0 };
              return { count: 1 };
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...ride, status: RideStatus.COMPLETED, stateVersion: 6
            }),
          },
          walletTransaction: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async (args: any) => {
              createdWalletTxs.push(args.data);
              return args.data;
            }),
          },
          driver: {
            findUnique: vi.fn().mockResolvedValue({ id: 'driver-1', walletBalance: new Prisma.Decimal(1000) }),
            update: vi.fn().mockImplementation(async (args: any) => {
              driverUpdateCalls.push(args);
              return {};
            }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(txProxy);
      });

      const results = await Promise.allSettled([
        rideService.completeRide('ride-1', 'user-1', 5),
        rideService.completeRide('ride-1', 'user-1', 5),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Only one wallet credit occurred
      expect(driverUpdateCalls).toHaveLength(1);
    });

    it('10. @@unique([rideId,type]) protects duplicate ledger creation', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);

      // Simulate DB unique constraint violation on second tx creation
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const txProxy = {
          ride: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ ...ride, status: RideStatus.COMPLETED, stateVersion: 6 }),
          },
          walletTransaction: {
            create: vi.fn().mockRejectedValue(
              new Error('Unique constraint failed on the fields: (`rideId`,`type`)')
            ),
          },
          driver: { update: vi.fn() },
          auditLog: { create: vi.fn() },
        };
        return cb(txProxy);
      });

      await expect(rideService.completeRide('ride-1', 'user-1', 5))
        .rejects.toThrow();

      // No wallet update should have occurred because the tx rolled back
      expect(driverUpdateCalls).toHaveLength(0);
    });

    it('11. already COMPLETED ride cannot settle again', async () => {
      const ride = buildInProgressRide({ status: RideStatus.COMPLETED });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);

      await expect(rideService.completeRide('ride-1', 'user-1', 5))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // C. Authorization / state
  // ============================================================

  describe('C. Authorization / state', () => {
    it('12. wrong driver rejected', async () => {
      const ride = buildInProgressRide({ driverId: 'other-driver' });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'driver-1', userId: 'user-1' });

      await expect(rideService.completeRide('ride-1', 'user-1', 5))
        .rejects.toThrow(ForbiddenException);
    });

    it('13. driver not found rejected', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(rideService.completeRide('ride-1', 'user-unknown', 5))
        .rejects.toThrow(ForbiddenException);
    });

    const invalidStates = [
      { name: '14. SEARCHING', status: RideStatus.SEARCHING },
      { name: '15. DRIVER_ASSIGNED', status: RideStatus.DRIVER_ASSIGNED },
      { name: '16. DRIVER_ARRIVED', status: RideStatus.DRIVER_ARRIVED },
      { name: '17. PASSENGER_BOARDED', status: RideStatus.PASSENGER_BOARDED },
      { name: '18. CANCELLED_BY_PASSENGER', status: RideStatus.CANCELLED_BY_PASSENGER },
    ];

    for (const { name, status } of invalidStates) {
      it(`${name} cannot complete`, async () => {
        const ride = buildInProgressRide({ status });
        mockPrisma.ride.findUnique.mockResolvedValue(ride);

        await expect(rideService.completeRide('ride-1', 'user-1', 5))
          .rejects.toThrow(BadRequestException);
      });
    }

    it('19. COMPLETED cannot complete again', async () => {
      const ride = buildInProgressRide({ status: RideStatus.COMPLETED });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);

      await expect(rideService.completeRide('ride-1', 'user-1', 5))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // D. Financial integrity
  // ============================================================

  describe('D. Financial integrity', () => {
    it('20. commission rounding uses ROUND_HALF_UP', async () => {
      // fare=33.33, commission=7% => 33.33*7/100 = 2.3331 => 2.33 (ROUND_HALF_UP)
      const ride = buildInProgressRide({
        snapBaseFare: new Prisma.Decimal('33.33'),
        snapPerKm: new Prisma.Decimal(0),
        snapPerMin: new Prisma.Decimal(0),
        snapSurge: new Prisma.Decimal(1),
        snapMinFare: new Prisma.Decimal(0),
        snapServiceFee: new Prisma.Decimal(7),
        distanceKm: new Prisma.Decimal(0),
        estimatedTime: 0,
      });
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      // 33.33 * 7 / 100 = 2.3331, ROUND_HALF_UP => 2.33
      expect(commTx.amount.toString()).toBe('2.33');
    });

    it('21. commission is not deducted twice', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // finalFare=228, commission=22.80 debited once: 1000 - 22.80 = 977.20
      expect(driverUpdateCalls).toHaveLength(1);
      const walletBalance = driverUpdateCalls[0].data.walletBalance;
      expect(walletBalance.toNumber()).toBe(977.2);
    });

    it('22. finalFare remains based on historical snapshots', async () => {
      const ride = buildInProgressRide();
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      await rideService.completeRide('ride-1', 'user-1', 5);

      // The PricingService was called with the ride's snap* values, not live ServiceType
      // Verify through the ledger: commission=22.80 debited based on snap Fare 228
      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      expect(commTx.amount.toNumber()).toBe(22.8);
    });

    it('23. live ServiceType changes do not alter completed ride calculation', async () => {
      // Even if ServiceType baseFare is now 999, the ride's snapBaseFare=50 is used
      const ride = buildInProgressRide(); // snapBaseFare=50
      mockPrisma.ride.findUnique.mockResolvedValue(ride);
      setupTransactionMock(ride);

      // ServiceType is never queried during completion — only snap* fields
      mockPrisma.serviceType = { findUnique: vi.fn().mockResolvedValue({ baseFare: new Prisma.Decimal(999) }) };

      await rideService.completeRide('ride-1', 'user-1', 5);

      // Result must still be based on snap values: (50+100+40)*1.2=228, commission=22.8
      const commTx = createdWalletTxs.find((t: any) => t.type === TransactionType.COMMISSION);
      expect(commTx.amount.toNumber()).toBe(22.8);
    });
  });
});
