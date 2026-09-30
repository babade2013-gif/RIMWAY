import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getLogs(skip: number, take: number) {
    return this.prisma.auditLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });
  }
}
