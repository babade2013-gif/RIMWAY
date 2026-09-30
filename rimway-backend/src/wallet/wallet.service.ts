import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, TransactionType, TopUpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Settles the financial side of a completed ride within an EXISTING Prisma transaction.
   * 
   * Business Model:
   * 1. The passenger pays 100% of finalFare directly in cash to the Captain.
   * 2. RIM WAY does NOT collect the ride fare from the passenger.
   * 3. Passenger fare is NEVER credited to the Captain's wallet.
   * 4. Captain wallet is a PRE-FUNDED operating balance.
   * 5. RIM WAY deducts its commission (COMMISSION DEBIT) from the Captain's wallet.
   * 
   * Duplicate protection:
   *   @@unique([rideId, type]) prevents duplicate ledger entries at the database level.
   */
  async settleRideFinancials(
    tx: Prisma.TransactionClient,
    rideId: string,
    driverId: string,
    finalFare: Prisma.Decimal,
    commissionPct: Prisma.Decimal,
  ) {
    // 1. Validate inputs
    if (finalFare.lessThan(0)) {
      throw new BadRequestException('finalFare cannot be negative');
    }
    if (commissionPct.lessThan(0)) {
      throw new BadRequestException('Commission percentage cannot be negative');
    }

    // 2. Calculate commission amount
    const commissionAmount = finalFare
      .mul(commissionPct)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const netEarnings = finalFare.minus(commissionAmount);

    // Prevent double deduction
    const existingCommission = await tx.walletTransaction.findFirst({
      where: { rideId, type: TransactionType.COMMISSION },
    });
    if (existingCommission) {
      throw new ConflictException(`Ride ${rideId} commission has already been settled`);
    }

    if (finalFare.isZero() || commissionAmount.isZero()) {
      return {
        finalFare,
        commissionAmount: new Prisma.Decimal(0),
        netEarnings,
        balanceBefore: new Prisma.Decimal(0),
        balanceAfter: new Prisma.Decimal(0),
      };
    }

    // 3. Fetch driver's current wallet balance within the transaction
    const driver = await tx.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const balanceBefore = driver.walletBalance;
    const balanceAfter = balanceBefore.sub(commissionAmount);

    // 4. Create single COMMISSION ledger transaction (DEBIT)
    await tx.walletTransaction.create({
      data: {
        driverId,
        rideId,
        amount: commissionAmount,
        type: TransactionType.COMMISSION,
        description: `عمولة منصة ريم واي عن الرحلة (الأجرة: ${finalFare} MRU، نسبة: ${commissionPct}%)`,
        balanceBefore,
        balanceAfter,
        rateSnapshot: commissionPct,
      },
    });

    // 5. Debit driver wallet balance
    await tx.driver.update({
      where: { id: driverId },
      data: { walletBalance: balanceAfter },
    });

    return { finalFare, commissionAmount, netEarnings, balanceBefore, balanceAfter };
  }

  // Top-Up Request & Approval Flow
  async createTopUpRequest(driverIdOrUserId: string, amount: number, reference?: string, notes?: string) {
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    let driver = await this.prisma.driver.findUnique({ where: { id: driverIdOrUserId } });
    if (!driver) {
      driver = await this.prisma.driver.findUnique({ where: { userId: driverIdOrUserId } });
    }
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.topUpRequest.create({
      data: {
        driverId: driver.id,
        amount: new Prisma.Decimal(amount),
        status: TopUpStatus.PENDING,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
      },
    });
  }

  async getDriverWallet(driverIdOrUserId: string) {
    let driver = await this.prisma.driver.findUnique({
      where: { id: driverIdOrUserId },
      include: {
        user: { select: { name: true, phone: true, photo: true } },
      },
    });
    if (!driver) {
      driver = await this.prisma.driver.findUnique({
        where: { userId: driverIdOrUserId },
        include: {
          user: { select: { name: true, phone: true, photo: true } },
        },
      });
    }
    if (!driver) throw new NotFoundException('Driver profile not found');

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const topUps = await this.prisma.topUpRequest.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      driverId: driver.id,
      walletBalance: Number(driver.walletBalance),
      rating: Number(driver.rating),
      totalTrips: driver.totalTrips,
      isExhausted: Number(driver.walletBalance) <= 0,
      transactions: transactions.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        direction: (t.type === TransactionType.COMMISSION || t.type === TransactionType.PENALTY || t.type === TransactionType.WITHDRAWAL || t.type === TransactionType.MANUAL_DEBIT) ? 'DEBIT' : 'CREDIT',
        balanceBefore: t.balanceBefore ? Number(t.balanceBefore) : null,
        balanceAfter: t.balanceAfter ? Number(t.balanceAfter) : null,
        rateSnapshot: t.rateSnapshot ? Number(t.rateSnapshot) : null,
        description: t.description,
        rideId: t.rideId,
        createdAt: t.createdAt,
      })),
      topUps: topUps.map(tp => ({
        id: tp.id,
        amount: Number(tp.amount),
        status: tp.status,
        reference: tp.reference,
        notes: tp.notes,
        rejectionReason: tp.rejectionReason,
        createdAt: tp.createdAt,
        processedAt: tp.processedAt,
      })),
    };
  }

  // Admin Top-up approvals
  async getTopUpRequests(status?: TopUpStatus) {
    return this.prisma.topUpRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: {
          include: {
            user: { select: { name: true, phone: true } },
            vehicle: true,
          },
        },
      },
    });
  }

  async approveTopUp(topUpId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const topUp = await tx.topUpRequest.findUnique({ where: { id: topUpId } });
      if (!topUp) throw new NotFoundException('TopUp request not found');
      if (topUp.status !== TopUpStatus.PENDING) {
        throw new ConflictException(`Cannot approve top-up with status ${topUp.status}`);
      }

      const driver = await tx.driver.findUnique({ where: { id: topUp.driverId } });
      if (!driver) throw new NotFoundException('Driver not found');

      const balanceBefore = driver.walletBalance;
      const balanceAfter = balanceBefore.add(topUp.amount);

      // 1. Update TopUp status
      const updatedTopUp = await tx.topUpRequest.update({
        where: { id: topUpId },
        data: {
          status: TopUpStatus.APPROVED,
          processedBy: adminId,
          processedAt: new Date(),
        },
      });

      // 2. Create Ledger entry
      await tx.walletTransaction.create({
        data: {
          driverId: driver.id,
          amount: topUp.amount,
          type: TransactionType.TOP_UP,
          description: `تزويد رصيد معتمد من الإدارة (مرجع: ${topUp.reference || 'تحويل مباشر'})`,
          balanceBefore,
          balanceAfter,
          actorId: adminId,
        },
      });

      // 3. Update driver wallet balance
      await tx.driver.update({
        where: { id: driver.id },
        data: { walletBalance: balanceAfter },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'TOPUP_APPROVED',
          entity: 'TopUpRequest',
          entityId: topUpId,
          reason: `TopUp approved for driver ${driver.id}: +${topUp.amount} MRU`,
          oldData: { status: TopUpStatus.PENDING, balanceBefore: balanceBefore.toString() },
          newData: { status: TopUpStatus.APPROVED, balanceAfter: balanceAfter.toString() },
        },
      });

      return updatedTopUp;
    });
  }

  async rejectTopUp(topUpId: string, adminId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is mandatory');
    }

    return this.prisma.$transaction(async (tx) => {
      const topUp = await tx.topUpRequest.findUnique({ where: { id: topUpId } });
      if (!topUp) throw new NotFoundException('TopUp request not found');
      if (topUp.status !== TopUpStatus.PENDING) {
        throw new ConflictException(`Cannot reject top-up with status ${topUp.status}`);
      }

      const updated = await tx.topUpRequest.update({
        where: { id: topUpId },
        data: {
          status: TopUpStatus.REJECTED,
          rejectionReason: reason.trim(),
          processedBy: adminId,
          processedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'TOPUP_REJECTED',
          entity: 'TopUpRequest',
          entityId: topUpId,
          reason: reason.trim(),
        },
      });

      return updated;
    });
  }

  // Admin Manual Credit / Debit
  async manualCredit(driverId: string, adminId: string, amount: number, reason: string) {
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is mandatory for manual credit');
    }

    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver) throw new NotFoundException('Driver not found');

      const creditAmount = new Prisma.Decimal(amount);
      const balanceBefore = driver.walletBalance;
      const balanceAfter = balanceBefore.add(creditAmount);

      await tx.walletTransaction.create({
        data: {
          driverId,
          amount: creditAmount,
          type: TransactionType.MANUAL_CREDIT,
          description: reason.trim(),
          balanceBefore,
          balanceAfter,
          actorId: adminId,
        },
      });

      await tx.driver.update({
        where: { id: driverId },
        data: { walletBalance: balanceAfter },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'WALLET_MANUAL_CREDIT',
          entity: 'Driver',
          entityId: driverId,
          reason: reason.trim(),
          oldData: { walletBalance: balanceBefore.toString() },
          newData: { walletBalance: balanceAfter.toString(), amount: creditAmount.toString() },
        },
      });

      return { driverId, amount: Number(creditAmount), balanceBefore: Number(balanceBefore), balanceAfter: Number(balanceAfter) };
    });
  }

  async manualDebit(driverId: string, adminId: string, amount: number, reason: string) {
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is mandatory for manual debit');
    }

    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver) throw new NotFoundException('Driver profile not found');

      const debitAmount = new Prisma.Decimal(amount);
      const balanceBefore = driver.walletBalance;
      const balanceAfter = balanceBefore.sub(debitAmount);

      await tx.walletTransaction.create({
        data: {
          driverId,
          amount: debitAmount,
          type: TransactionType.MANUAL_DEBIT,
          description: reason.trim(),
          balanceBefore,
          balanceAfter,
          actorId: adminId,
        },
      });

      await tx.driver.update({
        where: { id: driverId },
        data: { walletBalance: balanceAfter },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'WALLET_MANUAL_DEBIT',
          entity: 'Driver',
          entityId: driverId,
          reason: reason.trim(),
          oldData: { walletBalance: balanceBefore.toString() },
          newData: { walletBalance: balanceAfter.toString(), amount: debitAmount.toString() },
        },
      });

      return { driverId, amount: Number(debitAmount), balanceBefore: Number(balanceBefore), balanceAfter: Number(balanceAfter) };
    });
  }

  async getCaptainTransactions(driverId: string, limit: number = 100) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return transactions.map(t => ({
      ...t,
      amount: Number(t.amount),
      balanceBefore: t.balanceBefore ? Number(t.balanceBefore) : null,
      balanceAfter: t.balanceAfter ? Number(t.balanceAfter) : null,
      rateSnapshot: t.rateSnapshot ? Number(t.rateSnapshot) : null,
    }));
  }

  async getFinancialSummary() {
    const completedRides = await this.prisma.ride.findMany({
      where: { status: 'COMPLETED' },
      select: { finalFare: true },
    });
    const totalTripValue = completedRides.reduce((acc, r) => acc + Number(r.finalFare || 0), 0);

    const commissionSum = await this.prisma.walletTransaction.aggregate({
      where: { type: TransactionType.COMMISSION },
      _sum: { amount: true },
    });
    const totalCommission = Number(commissionSum._sum.amount || 0);

    const drivers = await this.prisma.driver.findMany({
      where: { status: 'APPROVED' },
      select: { walletBalance: true },
    });
    const totalCaptainWallets = drivers.reduce((acc, d) => acc + Number(d.walletBalance || 0), 0);
    const exhaustedCaptainsCount = drivers.filter(d => Number(d.walletBalance || 0) <= 0).length;

    const pendingTopUpsCount = await this.prisma.topUpRequest.count({
      where: { status: TopUpStatus.PENDING },
    });

    const approvedTopUps = await this.prisma.topUpRequest.aggregate({
      where: { status: TopUpStatus.APPROVED },
      _sum: { amount: true },
    });

    const manualCredits = await this.prisma.walletTransaction.aggregate({
      where: { type: TransactionType.MANUAL_CREDIT },
      _sum: { amount: true },
    });

    const manualDebits = await this.prisma.walletTransaction.aggregate({
      where: { type: TransactionType.MANUAL_DEBIT },
      _sum: { amount: true },
    });

    return {
      totalTripValue,
      totalCommission,
      totalCaptainWallets,
      exhaustedCaptainsCount,
      pendingTopUpsCount,
      approvedTopUpsTotal: Number(approvedTopUps._sum.amount || 0),
      manualCreditsTotal: Number(manualCredits._sum.amount || 0),
      manualDebitsTotal: Number(manualDebits._sum.amount || 0),
    };
  }
}
