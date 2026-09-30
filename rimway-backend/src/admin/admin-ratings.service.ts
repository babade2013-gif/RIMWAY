import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDriverRatings(driverId: string) {
    return this.prisma.rating.findMany({
      where: { driverId },
      include: { passenger: true, ride: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllRatings(skip: number, take: number) {
    return this.prisma.rating.findMany({
      skip,
      take,
      include: { passenger: true, driver: { include: { user: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }
}
