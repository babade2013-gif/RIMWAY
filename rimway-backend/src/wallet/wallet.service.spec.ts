import { WalletService } from './wallet.service';
import { Prisma, TransactionType, TopUpStatus } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WalletService - Operating Wallet Business Model', () => {
  let service: WalletService;
  let mockTx: any;
  let mockPrisma: any;
  let createdTransactions: any[];
  let driverRecord: any;

  beforeEach(() => {
    createdTransactions = [];
    driverRecord = {
      id: 'driver-1',
      walletBalance: new Prisma.Decimal(1000),
    };

    mockTx = {
      walletTransaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async (args: any) => {
          createdTransactions.push(args.data);
          return { id: `tx-${createdTransactions.length}`, ...args.data };
        }),
      },
      driver: {
        findUnique: vi.fn().mockImplementation(async () => ({ ...driverRecord })),
        update: vi.fn().mockImplementation(async (args: any) => {
          driverRecord.walletBalance = args.data.walletBalance;
          return { id: args.where.id, walletBalance: driverRecord.walletBalance };
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: any) => fn(mockTx)),
      driver: {
        findUnique: vi.fn().mockImplementation(async () => ({ ...driverRecord })),
        findMany: vi.fn().mockResolvedValue([
          { walletBalance: new Prisma.Decimal(500) },
          { walletBalance: new Prisma.Decimal(0) },
          { walletBalance: new Prisma.Decimal(-50) },
        ]),
      },
      ride: {
        findMany: vi.fn().mockResolvedValue([
          { finalFare: new Prisma.Decimal(200) },
          { finalFare: new Prisma.Decimal(300) },
        ]),
      },
      walletTransaction: {
        findMany: vi.fn().mockResolvedValue(createdTransactions),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(75) } }),
      },
      topUpRequest: {
        create: vi.fn().mockImplementation(async (args: any) => ({ id: 'topup-1', ...args.data })),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000) } }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    service = new WalletService(mockPrisma);
  });

  describe('settleRideFinancials - Operating Wallet Settlement', () => {
    it('1. should calculate commission correctly and debit captain wallet balance', async () => {
      // Starting balance = 1000 MRU, Fare = 200 MRU, Commission = 15% (30 MRU)
      const result = await service.settleRideFinancials(
        mockTx,
        'ride-1',
        'driver-1',
        new Prisma.Decimal(200),
        new Prisma.Decimal(15),
      );

      expect(result.commissionAmount.toNumber()).toBe(30);
      expect(result.netEarnings.toNumber()).toBe(170); // Cash kept by captain
      expect(result.finalFare.toNumber()).toBe(200);

      // Driver operating balance should be debited from 1000 to 970
      expect(driverRecord.walletBalance.toNumber()).toBe(970);
    });

    it('2. should NEVER create RIDE_FARE transaction (passenger pays cash directly)', async () => {
      await service.settleRideFinancials(
        mockTx,
        'ride-1',
        'driver-1',
        new Prisma.Decimal(200),
        new Prisma.Decimal(15),
      );

      const fareTransactions = createdTransactions.filter(t => t.type === TransactionType.RIDE_FARE);
      expect(fareTransactions).toHaveLength(0); // STRICT BUSINESS RULE
    });

    it('3. should create exactly one COMMISSION transaction with balanceBefore, balanceAfter, and rateSnapshot', async () => {
      await service.settleRideFinancials(
        mockTx,
        'ride-1',
        'driver-1',
        new Prisma.Decimal(200),
        new Prisma.Decimal(15),
      );

      expect(createdTransactions).toHaveLength(1);
      const commTx = createdTransactions[0];
      expect(commTx.type).toBe(TransactionType.COMMISSION);
      expect(commTx.amount.toNumber()).toBe(30);
      expect(commTx.balanceBefore.toNumber()).toBe(1000);
      expect(commTx.balanceAfter.toNumber()).toBe(970);
      expect(commTx.rateSnapshot.toNumber()).toBe(15);
      expect(commTx.rideId).toBe('ride-1');
      expect(commTx.driverId).toBe('driver-1');
    });

    it('4. should prevent double commission deduction if ride was already settled', async () => {
      mockTx.walletTransaction.findFirst.mockResolvedValueOnce({
        id: 'existing-tx',
        rideId: 'ride-1',
        type: TransactionType.COMMISSION,
      });

      await expect(
        service.settleRideFinancials(
          mockTx,
          'ride-1',
          'driver-1',
          new Prisma.Decimal(200),
          new Prisma.Decimal(15),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('5. should reject negative fare', async () => {
      await expect(
        service.settleRideFinancials(
          mockTx,
          'ride-1',
          'driver-1',
          new Prisma.Decimal(-50),
          new Prisma.Decimal(15),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. should reject negative commission rate', async () => {
      await expect(
        service.settleRideFinancials(
          mockTx,
          'ride-1',
          'driver-1',
          new Prisma.Decimal(100),
          new Prisma.Decimal(-5),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. should handle zero fare without modifying wallet balance', async () => {
      const result = await service.settleRideFinancials(
        mockTx,
        'ride-1',
        'driver-1',
        new Prisma.Decimal(0),
        new Prisma.Decimal(15),
      );

      expect(result.commissionAmount.toNumber()).toBe(0);
      expect(result.netEarnings.toNumber()).toBe(0);
      expect(driverRecord.walletBalance.toNumber()).toBe(1000);
      expect(createdTransactions).toHaveLength(0);
    });
  });

  describe('TopUpRequest Lifecycle - WhatsApp Flow', () => {
    it('8. should create a pending top-up request', async () => {
      const req = await service.createTopUpRequest('driver-1', 500, 'REF-1234', 'Bankily transfer');
      expect(req).toBeDefined();
      expect(req.status).toBe(TopUpStatus.PENDING);
      expect(req.amount.toNumber()).toBe(500);
    });

    it('9. should reject top-up request with non-positive amount', async () => {
      await expect(service.createTopUpRequest('driver-1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.createTopUpRequest('driver-1', -100)).rejects.toThrow(BadRequestException);
    });

    it('10. should approve pending top-up and credit captain operating balance', async () => {
      mockTx.topUpRequest = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'topup-1',
          driverId: 'driver-1',
          amount: new Prisma.Decimal(500),
          status: TopUpStatus.PENDING,
          reference: 'REF-1234',
        }),
        update: vi.fn().mockImplementation(async (args: any) => ({
          id: 'topup-1',
          ...args.data,
        })),
      };

      const approved = await service.approveTopUp('topup-1', 'admin-user-1');
      expect(approved.status).toBe(TopUpStatus.APPROVED);

      // Wallet balance was 1000, now 1000 + 500 = 1500
      expect(driverRecord.walletBalance.toNumber()).toBe(1500);

      const topUpTx = createdTransactions.find(t => t.type === TransactionType.TOP_UP);
      expect(topUpTx).toBeDefined();
      expect(topUpTx.balanceBefore.toNumber()).toBe(1000);
      expect(topUpTx.balanceAfter.toNumber()).toBe(1500);
      expect(topUpTx.actorId).toBe('admin-user-1');
    });

    it('11. should reject pending top-up with mandatory rejection reason and leave wallet unchanged', async () => {
      mockTx.topUpRequest = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'topup-1',
          driverId: 'driver-1',
          amount: new Prisma.Decimal(500),
          status: TopUpStatus.PENDING,
        }),
        update: vi.fn().mockImplementation(async (args: any) => ({
          id: 'topup-1',
          ...args.data,
        })),
      };

      const rejected = await service.rejectTopUp('topup-1', 'admin-user-1', 'Bank transfer receipt unverified');
      expect(rejected.status).toBe(TopUpStatus.REJECTED);
      expect(rejected.rejectionReason).toBe('Bank transfer receipt unverified');

      // Wallet balance unchanged
      expect(driverRecord.walletBalance.toNumber()).toBe(1000);
      expect(createdTransactions).toHaveLength(0);
    });

    it('12. should throw if rejection reason is empty', async () => {
      await expect(service.rejectTopUp('topup-1', 'admin-user-1', '   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('Admin Manual Credit & Debit with Audit Trail', () => {
    it('13. should manually credit driver wallet with audit log and balance tracking', async () => {
      await service.manualCredit('driver-1', 'admin-1', 250, 'Promotional bonus');

      expect(driverRecord.walletBalance.toNumber()).toBe(1250);
      const creditTx = createdTransactions.find(t => t.type === TransactionType.MANUAL_CREDIT);
      expect(creditTx).toBeDefined();
      expect(creditTx.amount.toNumber()).toBe(250);
      expect(creditTx.balanceBefore.toNumber()).toBe(1000);
      expect(creditTx.balanceAfter.toNumber()).toBe(1250);
      expect(creditTx.actorId).toBe('admin-1');
    });

    it('14. should manually debit driver wallet with audit log and balance tracking', async () => {
      await service.manualDebit('driver-1', 'admin-1', 200, 'Adjustment for penalty');

      expect(driverRecord.walletBalance.toNumber()).toBe(800);
      const debitTx = createdTransactions.find(t => t.type === TransactionType.MANUAL_DEBIT);
      expect(debitTx).toBeDefined();
      expect(debitTx.amount.toNumber()).toBe(200);
      expect(debitTx.balanceBefore.toNumber()).toBe(1000);
      expect(debitTx.balanceAfter.toNumber()).toBe(800);
      expect(debitTx.actorId).toBe('admin-1');
    });

    it('15. should require non-empty reason for manual credit and debit', async () => {
      await expect(service.manualCredit('driver-1', 'admin-1', 100, '')).rejects.toThrow(BadRequestException);
      await expect(service.manualDebit('driver-1', 'admin-1', 100, '  ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFinancialSummary - Authoritative Platform Metrics', () => {
    it('16. should calculate distinct operational trip value, platform commission, and exhausted captains count', async () => {
      const summary = await service.getFinancialSummary();

      // Completed rides = 200 + 300 = 500
      expect(summary.totalTripValue).toBe(500);

      // Total commission = 75
      expect(summary.totalCommission).toBe(75);

      // Captain wallets: 500 + 0 + (-50) = 450
      expect(summary.totalCaptainWallets).toBe(450);

      // Drivers with balance <= 0: [0, -50] => 2 drivers
      expect(summary.exhaustedCaptainsCount).toBe(2);
    });
  });
});
