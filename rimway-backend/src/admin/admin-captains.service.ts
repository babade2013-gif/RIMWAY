import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaptainDto, UpdateCaptainDto, VehicleDto, ActionReasonDto } from './dto/captain-admin.dto';
import { UserRole, DriverStatus } from '@prisma/client';

@Injectable()
export class AdminCaptainsService {
  constructor(private prisma: PrismaService) {}

  async getCaptains(query: any) {
    const { status, isOnline, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (isOnline !== undefined) where.isOnline = isOnline === 'true';

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ]
      };
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: {
          user: { select: { name: true, phone: true, isActive: true } },
          vehicle: { select: { plateNumber: true, brand: true, model: true } },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { data: drivers, total, page: Number(page), limit: Number(limit) };
  }

  async getCaptainDetails(id: string) {
    let driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, photo: true, language: true, isActive: true } },
        vehicle: true,
        documents: true,
      },
    });

    if (!driver) {
      driver = await this.prisma.driver.findFirst({
        where: { OR: [{ id }, { userId: id }] },
        include: {
          user: { select: { id: true, name: true, phone: true, photo: true, language: true, isActive: true } },
          vehicle: true,
          documents: true,
        },
      });
    }

    if (!driver) throw new NotFoundException('Captain not found');
    return driver;
  }

  async createCaptain(adminId: string, dto: CreateCaptainDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existingUser) {
      throw new ConflictException('Phone number already exists');
    }

    if (dto.vehicle) {
      const existingVehicle = await this.prisma.vehicle.findUnique({ where: { plateNumber: dto.vehicle.plateNumber } });
      if (existingVehicle) {
        throw new ConflictException('Plate number already exists');
      }
      const serviceType = await this.prisma.serviceType.findUnique({ where: { id: dto.vehicle.serviceTypeId } });
      if (!serviceType) {
        throw new BadRequestException('Invalid serviceTypeId');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          name: dto.name,
          role: UserRole.DRIVER,
        },
      });

      const driver = await tx.driver.create({
        data: {
          userId: user.id,
          status: DriverStatus.PENDING,
        },
      });

      let vehicle = null;
      if (dto.vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            ...dto.vehicle,
            driverId: driver.id,
          },
        });
      }

      // Add any documents or vehicle photos provided during manual creation
      const allFiles = [...(dto.documents || []), ...(dto.vehiclePhotos || [])];
      for (const file of allFiles) {
        await tx.driverDocument.create({
          data: {
            driverId: driver.id,
            type: file.type,
            fileUrl: file.fileUrl,
            fileName: file.fileName,
            mimeType: file.mimeType,
            status: 'PENDING',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'CAPTAIN_CREATED',
          entity: 'DRIVER',
          entityId: driver.id,
          newData: { phone: dto.phone, name: dto.name, hasVehicle: !!dto.vehicle, documentsCount: allFiles.length },
        },
      });

      return { user, driver, vehicle };
    });
  }

  async approveCaptain(id: string, adminId: string, dto: ActionReasonDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Captain not found');

    if (driver.status === DriverStatus.APPROVED) {
      throw new ConflictException('Captain is already approved');
    }

    const updated = await this.prisma.driver.update({
      where: { id },
      data: {
        status: DriverStatus.APPROVED,
        rejectionReason: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_APPROVED',
        entity: 'DRIVER',
        entityId: id,
        oldData: { status: driver.status },
        newData: { status: DriverStatus.APPROVED },
        reason: dto.reason,
      },
    });

    return updated;
  }

  async rejectCaptain(id: string, adminId: string, dto: ActionReasonDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Rejection reason is mandatory');
    }
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Captain not found');

    if (driver.status === DriverStatus.APPROVED) {
      throw new ConflictException('Cannot reject an already approved captain. Use suspend instead.');
    }

    const updated = await this.prisma.driver.update({
      where: { id },
      data: {
        status: DriverStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
        isOnline: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_REJECTED',
        entity: 'DRIVER',
        entityId: id,
        oldData: { status: driver.status },
        newData: { status: DriverStatus.REJECTED, rejectionReason: dto.reason.trim() },
        reason: dto.reason.trim(),
      },
    });

    return updated;
  }

  async suspendCaptain(id: string, adminId: string, dto: ActionReasonDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Captain not found');

    if (driver.status === DriverStatus.SUSPENDED) {
      throw new ConflictException('Captain is already suspended');
    }

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { status: DriverStatus.SUSPENDED, isOnline: false }, // Prevent receiving rides
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_SUSPENDED',
        entity: 'DRIVER',
        entityId: id,
        oldData: { status: driver.status, isOnline: driver.isOnline },
        newData: { status: DriverStatus.SUSPENDED, isOnline: false },
        reason: dto.reason,
      },
    });

    // Note: To immediately evict them from Redis dispatch we might want to call Redis if we had the service injected.
    // For now, setting isOnline to false handles the DB, and DriverService syncs or checks this.

    return updated;
  }

  async reactivateCaptain(id: string, adminId: string, dto: ActionReasonDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Captain not found');

    if (driver.status !== DriverStatus.SUSPENDED) {
      throw new ConflictException('Captain is not suspended');
    }

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { status: DriverStatus.APPROVED }, // Do not auto-set isOnline to true
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_REACTIVATED',
        entity: 'DRIVER',
        entityId: id,
        oldData: { status: driver.status },
        newData: { status: DriverStatus.APPROVED },
        reason: dto.reason,
      },
    });

    return updated;
  }

  async updatePriorityTier(id: string, adminId: string, priorityTier: string, reason?: string) {
    if (!['NORMAL', 'PREFERRED'].includes(priorityTier)) {
      throw new BadRequestException('Invalid priority tier. Must be NORMAL or PREFERRED');
    }
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundException('Captain not found');

    const updated = await this.prisma.driver.update({
      where: { id },
      data: { priorityTier },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_PRIORITY_UPDATED',
        entity: 'DRIVER',
        entityId: id,
        oldData: { priorityTier: driver.priorityTier },
        newData: { priorityTier },
        reason,
      },
    });

    return updated;
  }

  async updateCaptain(id: string, adminId: string, dto: UpdateCaptainDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id }, include: { user: true } });
    if (!driver) throw new NotFoundException('Captain not found');

    const updatedUser = await this.prisma.user.update({
      where: { id: driver.userId },
      data: {
        name: dto.name,
        photo: dto.photo,
        language: dto.language,
        isActive: dto.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CAPTAIN_UPDATED',
        entity: 'USER',
        entityId: driver.userId,
        newData: dto as any,
      },
    });

    return updatedUser;
  }

  async updateVehicle(id: string, adminId: string, dto: VehicleDto) {
    const driver = await this.prisma.driver.findUnique({ where: { id }, include: { vehicle: true } });
    if (!driver) throw new NotFoundException('Captain not found');

    const serviceType = await this.prisma.serviceType.findUnique({ where: { id: dto.serviceTypeId } });
    if (!serviceType) {
      throw new BadRequestException('Invalid serviceTypeId');
    }

    const existingVehicleWithPlate = await this.prisma.vehicle.findUnique({ where: { plateNumber: dto.plateNumber } });
    if (existingVehicleWithPlate && existingVehicleWithPlate.driverId !== id) {
      throw new ConflictException('Plate number already assigned to another driver');
    }

    let vehicle;
    if (driver.vehicle) {
      vehicle = await this.prisma.vehicle.update({
        where: { driverId: id },
        data: dto,
      });
      await this.prisma.auditLog.create({
        data: { userId: adminId, action: 'VEHICLE_UPDATED', entity: 'VEHICLE', entityId: vehicle.id, newData: dto as any },
      });
    } else {
      vehicle = await this.prisma.vehicle.create({
        data: { ...dto, driverId: id },
      });
      await this.prisma.auditLog.create({
        data: { userId: adminId, action: 'VEHICLE_CREATED', entity: 'VEHICLE', entityId: vehicle.id, newData: dto as any },
      });
    }

    return vehicle;
  }

  async getWallet(id: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id }, select: { walletBalance: true } });
    if (!driver) throw new NotFoundException('Captain not found');
    return driver;
  }

  async getWalletTransactions(id: string, query: any) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { driverId: id },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where: { driverId: id } }),
    ]);

    return { data: transactions, total, page: Number(page), limit: Number(limit) };
  }

  async getComplaints(id: string, query: any) {
    // Need to find complaints related to this driver's rides
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { ride: { driverId: id } };

    const [complaints, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, phone: true } },
          ride: { select: { id: true, rideCode: true } },
        },
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return { data: complaints, total, page: Number(page), limit: Number(limit) };
  }
}
