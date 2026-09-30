import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPricing() {
    return this.prisma.serviceType.findMany({ orderBy: { name: 'asc' } });
  }

  async updatePricing(id: string, data: any, adminId: string) {
    const { version, ...updateData } = data;
    
    const existing = await this.prisma.serviceType.findUnique({ where: { id } });
    if (!existing) throw new Error('Not found');
    if (version !== undefined && existing.version !== version) {
      throw new ConflictException('Data was modified by someone else');
    }

    const nextVersion = (existing.version || 1) + 1;
    const updated = await this.prisma.serviceType.update({
      where: { id },
      data: { ...updateData, version: nextVersion }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_PRICING',
        entity: 'ServiceType',
        entityId: id,
        oldData: existing as any,
        newData: updated as any
      }
    });

    return updated;
  }
}
