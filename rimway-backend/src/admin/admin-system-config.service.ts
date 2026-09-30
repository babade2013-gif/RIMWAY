import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  private cachedMinBalance: number | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the minimum wallet balance required to receive rides.
   * Uses in-memory cache to avoid hitting DB on every dispatch check.
   */
  async getMinWalletBalance(): Promise<number> {
    if (this.cachedMinBalance !== null) return this.cachedMinBalance;
    const config = await this.prisma.systemConfig.findUnique({
      where: { id: 'global' },
    });
    this.cachedMinBalance = config ? Number(config.minWalletBalance) : 0;
    return this.cachedMinBalance;
  }

  /**
   * Get full system config (for admin UI).
   */
  async getConfig() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { id: 'global' },
    });
    return {
      minWalletBalance: config ? Number(config.minWalletBalance) : 0,
      updatedAt: config?.updatedAt ?? null,
    };
  }

  /**
   * Update minimum wallet balance and invalidate cache.
   */
  async setMinWalletBalance(amount: number, adminId: string) {
    const config = await this.prisma.systemConfig.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        minWalletBalance: amount,
        updatedByAdminId: adminId,
      },
      update: {
        minWalletBalance: amount,
        updatedByAdminId: adminId,
      },
    });
    // Invalidate cache
    this.cachedMinBalance = null;
    return {
      minWalletBalance: Number(config.minWalletBalance),
      updatedAt: config.updatedAt,
    };
  }
}
