import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async getComplaints(status?: string) {
    return this.prisma.complaint.findMany({
      where: status ? { status } : undefined,
      include: { reporter: true, ride: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStatus(id: string, status: string, adminId: string) {
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: { status }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_COMPLAINT_STATUS',
        entity: 'Complaint',
        entityId: id,
        newData: { status }
      }
    });

    return updated;
  }
}
