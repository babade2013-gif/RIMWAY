import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDocuments(driverId: string) {
    const docs = await this.prisma.driverDocument.findMany({ where: { driverId } });
    if (docs.length > 0) return docs;
    const driver = await this.prisma.driver.findFirst({ where: { OR: [{ id: driverId }, { userId: driverId }] } });
    if (driver) {
      return this.prisma.driverDocument.findMany({ where: { driverId: driver.id } });
    }
    return [];
  }

  async createDocumentMetadata(data: any) {
    return this.prisma.driverDocument.create({ data });
  }

  async updateStatus(id: string, status: string, verifiedBy: string) {
    return this.prisma.driverDocument.update({
      where: { id },
      data: { status, verifiedBy, verifiedAt: new Date() }
    });
  }
}
