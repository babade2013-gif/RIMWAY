import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverRegistrationDto } from './dto/driver-registration.dto';
import { SystemConfigService } from '../admin/admin-system-config.service';
import Redis from 'ioredis';

@Injectable()
export class DriverService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private systemConfigService: SystemConfigService,
  ) {
    // Note: Connection error will be logged but won't crash process if Redis is missing in test env
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { lazyConnect: true, showFriendlyErrorStack: true });
    this.redis.connect().catch(() => console.warn('Redis unavailable'));
  }

  get redisClient(): Redis {
    return this.redis;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const driver: any = await this.prisma.driver.update({
      where: { userId },
      data: { isOnline }
    });
    if (!isOnline) {
      // Remove from Geo index
      await this.redis.zrem('drivers:location', driver.id).catch(()=>{});
    }
    return driver;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver not found');
    
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { currentLat: lat, currentLng: lng }
    });

    if (driver.isOnline) {
      // Store in Redis GEO
      await this.redis.geoadd('drivers:location', lng, lat, driver.id).catch(()=>{});
      const freshness = parseInt(process.env.DISPATCH_FRESHNESS_SEC || '60', 10);
      await this.redis.set(`driver:freshness:${driver.id}`, '1', 'EX', freshness).catch(()=>{});
    }
    return { success: true };
  }

  async findNearbyDrivers(lat: number, lng: number, radiusKm: number = 5): Promise<string[]> {
    try {
      const results = await this.redis.geosearch(
        'drivers:location',
        'FROMLONLAT', lng, lat,
        'BYRADIUS', radiusKm, 'km',
        'ASC'
      );
      return results as string[];
    } catch {
      return []; // Return empty if redis fails
    }
  }

  async findNearbyEligibleDrivers(lat: number, lng: number, radiusKm: number, rideId: string, cycleId: number, topN: number): Promise<string[]> {
    try {
      const results = await this.findNearbyDrivers(lat, lng, radiusKm);
      if (!results.length) return [];

      const candidateList: { driverId: string, priorityTier: string, index: number }[] = [];
      let index = 0;

      for (const driverId of results) {
        // Check freshness
        const isFresh = await this.redis.exists(`driver:freshness:${driverId}`);
        if (!isFresh) continue;

        // Check driver status, isOnline, and walletBalance (must have positive operating balance)
        const driverProfile = await this.prisma.driver.findUnique({
          where: { id: driverId },
          select: { status: true, isOnline: true, priorityTier: true, walletBalance: true }
        });
        if (!driverProfile || driverProfile.status !== 'APPROVED' || !driverProfile.isOnline) continue;
        // Dynamic minimum balance set by admin (default 0 = must have positive balance)
        const minBalance = await this.systemConfigService.getMinWalletBalance();
        if (driverProfile.walletBalance !== undefined &&
            Number(driverProfile.walletBalance) < minBalance) continue;

        // Check active ride (Postgres is authoritative)
        // Active states: DRIVER_ASSIGNED, DRIVER_ARRIVING, DRIVER_ARRIVED, WAITING_FOR_PASSENGER, PASSENGER_BOARDED, IN_PROGRESS
        const activeRide = await this.prisma.ride.findFirst({
          where: {
            driverId: driverId,
            status: { in: ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'WAITING_FOR_PASSENGER', 'PASSENGER_BOARDED', 'IN_PROGRESS'] }
          }
        });
        if (activeRide) continue;

        candidateList.push({ driverId, priorityTier: driverProfile.priorityTier, index: index++ });
      }

      // Sort: PREFERRED first, then by distance (original index)
      candidateList.sort((a, b) => {
        if (a.priorityTier === 'PREFERRED' && b.priorityTier !== 'PREFERRED') return -1;
        if (b.priorityTier === 'PREFERRED' && a.priorityTier !== 'PREFERRED') return 1;
        return a.index - b.index;
      });

      const eligible: string[] = [];
      const cycleTtl = parseInt(process.env.DISPATCH_CYCLE_TTL_SEC || '30', 10);

      for (const candidate of candidateList) {
        if (eligible.length >= topN) break;

        // Check duplicate dispatch
        const dispatchKey = `dispatched:${rideId}:${cycleId}:${candidate.driverId}`;
        const setNx = await this.redis.set(dispatchKey, '1', 'EX', cycleTtl, 'NX');
        if (setNx) {
          eligible.push(candidate.driverId);
        }
      }

      return eligible;
    } catch {
      return [];
    }
  }

  async getDriverMe(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, phone: true, photo: true, language: true, isActive: true } },
        vehicle: {
          include: {
            serviceType: { select: { id: true, name: true } },
          },
        },
        documents: true,
      },
    });

    if (!driver) throw new NotFoundException('Driver profile not found');

    // Calculate logical registrationStatus
    let registrationStatus: string;
    if (driver.status === 'APPROVED') {
      registrationStatus = 'APPROVED';
    } else if (driver.status === 'SUSPENDED') {
      registrationStatus = 'SUSPENDED';
    } else if (driver.status === 'REJECTED') {
      registrationStatus = 'REJECTED';
    } else {
      // status === 'PENDING'
      const docTypes = (driver.documents || []).map(d => d.type);
      const hasVehicle = !!driver.vehicle;
      const hasNationalId = docTypes.includes('NATIONAL_ID');
      const hasDrivingLicense = docTypes.includes('DRIVING_LICENSE');
      const hasInsurance = docTypes.includes('VEHICLE_INSURANCE');
      const hasRegistration = docTypes.includes('VEHICLE_REGISTRATION');
      const hasFrontPhoto = docTypes.includes('VEHICLE_FRONT');
      const hasBackPhoto = docTypes.includes('VEHICLE_BACK');
      const hasRightPhoto = docTypes.includes('VEHICLE_RIGHT');
      const hasLeftPhoto = docTypes.includes('VEHICLE_LEFT');

      const isComplete = hasVehicle &&
        hasNationalId &&
        hasDrivingLicense &&
        hasInsurance &&
        hasRegistration &&
        hasFrontPhoto &&
        hasBackPhoto &&
        hasRightPhoto &&
        hasLeftPhoto;

      registrationStatus = isComplete ? 'PENDING_REVIEW' : 'REGISTRATION_INCOMPLETE';
    }

    return {
      ...driver,
      walletBalance: Number(driver.walletBalance ?? 0),
      rating: Number(driver.rating ?? 5.0),
      registrationStatus,
    };
  }

  async submitRegistration(userId: string, dto: DriverRegistrationDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { vehicle: true },
    });
    if (!driver) throw new NotFoundException('Driver profile not found');

    // Validate serviceTypeId
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: dto.vehicle.serviceTypeId },
    });
    if (!serviceType) {
      throw new BadRequestException('Invalid serviceTypeId');
    }

    // Validate plate uniqueness
    const existingVehicleWithPlate = await this.prisma.vehicle.findUnique({
      where: { plateNumber: dto.vehicle.plateNumber },
    });
    if (existingVehicleWithPlate && existingVehicleWithPlate.driverId !== driver.id) {
      throw new ConflictException('Plate number already assigned to another vehicle');
    }

    // Validate required documents
    const docTypes = dto.documents.map(d => d.type);
    const requiredDocs = ['NATIONAL_ID', 'DRIVING_LICENSE', 'VEHICLE_INSURANCE', 'VEHICLE_REGISTRATION'];
    for (const reqDoc of requiredDocs) {
      if (!docTypes.includes(reqDoc)) {
        throw new BadRequestException(`Missing mandatory document: ${reqDoc}`);
      }
    }

    // Validate 4 vehicle photos
    const photoTypes = dto.vehiclePhotos.map(p => p.type);
    const requiredPhotos = ['VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_RIGHT', 'VEHICLE_LEFT'];
    for (const reqPhoto of requiredPhotos) {
      if (!photoTypes.includes(reqPhoto)) {
        throw new BadRequestException(`Missing mandatory vehicle photo: ${reqPhoto}`);
      }
    }

    // Execute in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update user info (name, photo)
      await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          ...(dto.photo ? { photo: dto.photo } : {}),
        },
      });

      // 2. Upsert vehicle
      let vehicle;
      if (driver.vehicle) {
        vehicle = await tx.vehicle.update({
          where: { driverId: driver.id },
          data: {
            brand: dto.vehicle.brand,
            model: dto.vehicle.model,
            year: dto.vehicle.year,
            color: dto.vehicle.color,
            plateNumber: dto.vehicle.plateNumber,
            serviceTypeId: dto.vehicle.serviceTypeId,
          },
        });
      } else {
        vehicle = await tx.vehicle.create({
          data: {
            driverId: driver.id,
            brand: dto.vehicle.brand,
            model: dto.vehicle.model,
            year: dto.vehicle.year,
            color: dto.vehicle.color,
            plateNumber: dto.vehicle.plateNumber,
            serviceTypeId: dto.vehicle.serviceTypeId,
          },
        });
      }

      // 3. Upsert documents & photos into DriverDocument
      const allFiles = [...dto.documents, ...dto.vehiclePhotos];
      for (const file of allFiles) {
        const existingDoc = await tx.driverDocument.findFirst({
          where: { driverId: driver.id, type: file.type },
        });

        if (existingDoc) {
          await tx.driverDocument.update({
            where: { id: existingDoc.id },
            data: {
              fileUrl: file.fileUrl,
              fileName: file.fileName,
              mimeType: file.mimeType,
              status: 'PENDING',
              uploadedAt: new Date(),
            },
          });
        } else {
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
      }

      // 4. Update driver status to PENDING, clear rejectionReason
      const updatedDriver = await tx.driver.update({
        where: { id: driver.id },
        data: {
          status: 'PENDING',
          rejectionReason: null,
        },
        include: {
          user: { select: { id: true, name: true, phone: true, photo: true } },
          vehicle: true,
          documents: true,
        },
      });

      // 5. Create AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DRIVER_REGISTRATION_SUBMITTED',
          entity: 'DRIVER',
          entityId: driver.id,
          newData: {
            plateNumber: dto.vehicle.plateNumber,
            serviceTypeId: dto.vehicle.serviceTypeId,
            documentsCount: allFiles.length,
          },
        },
      });

      return updatedDriver;
    });

    return {
      ...result,
      registrationStatus: 'PENDING_REVIEW',
    };
  }
}
