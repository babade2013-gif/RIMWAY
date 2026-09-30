import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const tz = 'Africa/Nouakchott';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(now);
    const dateMap: Record<string, string> = {};
    parts.forEach(p => { dateMap[p.type] = p.value; });
    
    // Construct start of day in Nouakchott
    const startOfDay = new Date(Date.UTC(Number(dateMap.year), Number(dateMap.month) - 1, Number(dateMap.day), 0, 0, 0));
    const offsetNouakchott = 0; // GMT+0
    startOfDay.setHours(startOfDay.getHours() - offsetNouakchott);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const ridesToday = await this.prisma.ride.count({
      where: { createdAt: { gte: startOfDay, lt: endOfDay } }
    });

    const completedRidesToday = await this.prisma.ride.count({
      where: { status: 'COMPLETED', updatedAt: { gte: startOfDay, lt: endOfDay } }
    });

    const cancelledRidesToday = await this.prisma.ride.count({
      where: { status: { in: ['CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'CANCELLED_BY_ADMIN', 'NO_DRIVER_FOUND'] }, updatedAt: { gte: startOfDay, lt: endOfDay } }
    });

    const onlineCaptains = await this.prisma.driver.count({
      where: { isOnline: true, status: 'APPROVED' }
    });

    const busyCaptains = await this.prisma.ride.count({
      where: { status: { in: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'WAITING_FOR_PASSENGER', 'PASSENGER_BOARDED', 'IN_PROGRESS'] } }
    });

    const availableCaptains = Math.max(0, onlineCaptains - busyCaptains);

    const pendingCaptains = await this.prisma.driver.count({ where: { status: 'PENDING' } });
    const suspendedCaptains = await this.prisma.driver.count({ where: { status: 'SUSPENDED' } });

    const completedRides = await this.prisma.ride.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: startOfDay, lt: endOfDay } },
      select: { finalFare: true }
    });
    const grossFare = completedRides.reduce((sum, r) => sum + Number(r.finalFare || 0), 0);

    const approvedDrivers = await this.prisma.driver.findMany({
      where: { status: 'APPROVED' },
      select: { walletBalance: true },
    });
    const totalCaptainWallets = approvedDrivers.reduce((sum, d) => sum + Number(d.walletBalance || 0), 0);
    const exhaustedCaptainsCount = approvedDrivers.filter(d => Number(d.walletBalance || 0) <= 0).length;

    const pendingTopUps = await this.prisma.topUpRequest.count({
      where: { status: 'PENDING' }
    });

    const commissions = await this.prisma.walletTransaction.aggregate({
      where: { type: TransactionType.COMMISSION, createdAt: { gte: startOfDay, lt: endOfDay } },
      _sum: { amount: true },
    });

    const commissionAmount = Number(commissions._sum.amount || 0);
    const captainCashEarnings = Math.max(0, grossFare - commissionAmount);

    return {
      todayRides: ridesToday,
      completedRides: completedRidesToday,
      cancelledRides: cancelledRidesToday,
      onlineCaptains,
      availableCaptains,
      pendingCaptains,
      suspendedCaptains,
      grossFare,
      commission: commissionAmount,
      netEarnings: captainCashEarnings,
      totalTripValue: grossFare,
      totalCommission: commissionAmount,
      totalCaptainWallets,
      exhaustedCaptainsCount,
      pendingTopUpsCount: pendingTopUps,
    };
  }
}
