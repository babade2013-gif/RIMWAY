import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RideService } from '../rides/ride.service';
import { CreatePhoneRideDto, AdminCancelRideDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rideService: RideService,
  ) {}

  async getRides() {
    const rides = await this.prisma.ride.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicle: true } },
      },
    });

    const cancelledRideIds = rides
      .filter((r) => r.status && r.status.includes('CANCEL'))
      .map((r) => r.id);

    let cancelLogs: any[] = [];
    if (cancelledRideIds.length > 0) {
      cancelLogs = await this.prisma.auditLog.findMany({
        where: {
          entity: 'Ride',
          entityId: { in: cancelledRideIds },
          action: { in: ['RIDE_CANCELLED', 'ADMIN_RIDE_CANCELLED', 'RIDE_CANCELLED_BY_DRIVER'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const cancelReasonMap = new Map<string, string>();
    for (const log of cancelLogs) {
      if (!cancelReasonMap.has(log.entityId) && log.reason) {
        cancelReasonMap.set(log.entityId, log.reason);
      }
    }

    return rides.map((r) => ({
      ...r,
      cancelReason: cancelReasonMap.get(r.id) || null,
      driverName: r.driver?.user?.name || (r.driver?.user?.phone ? `كابتن (${r.driver.user.phone})` : (r.driver ? 'كابتن ريمواي' : null)),
      driverPhone: r.driver?.user?.phone || null,
      driverVehicle: r.driver?.vehicle ? `${r.driver.vehicle.brand} ${r.driver.vehicle.model} (${r.driver.vehicle.plateNumber})` : null,
    }));
  }

  async getRideDetails(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        driver: { select: { id: true, user: { select: { name: true, phone: true } }, vehicle: true } },
        serviceType: { select: { name: true } },
      },
    });
    if (!ride) throw new NotFoundException('Ride not found');

    let cancelReason: string | null = null;
    if (ride.status && ride.status.includes('CANCEL')) {
      const cancelLog = await this.prisma.auditLog.findFirst({
        where: {
          entity: 'Ride',
          entityId: rideId,
          action: { in: ['RIDE_CANCELLED', 'ADMIN_RIDE_CANCELLED', 'RIDE_CANCELLED_BY_DRIVER'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (cancelLog?.reason) cancelReason = cancelLog.reason;
    }

    return {
      ...ride,
      cancelReason,
      driverName: ride.driver?.user?.name || (ride.driver?.user?.phone ? `كابتن (${ride.driver.user.phone})` : (ride.driver ? 'كابتن ريمواي' : null)),
      driverPhone: ride.driver?.user?.phone || null,
      driverVehicle: ride.driver?.vehicle ? `${ride.driver.vehicle.brand} ${ride.driver.vehicle.model} (${ride.driver.vehicle.plateNumber})` : null,
      distanceKm: ride.distanceKm != null ? Number(ride.distanceKm) : null,
      estimatedFare: ride.estimatedFare != null ? Number(ride.estimatedFare) : null,
      finalFare: ride.finalFare != null ? Number(ride.finalFare) : null,
    };
  }

  async createPhoneRide(adminId: string, dto: CreatePhoneRideDto, idempotencyKey?: string) {
    // We delegate the creation to RideService to ensure pricing, dispatch, and lifecycle logic is identical
    return this.rideService.createPhoneRide(adminId, dto, idempotencyKey);
  }

  async cancelRide(rideId: string, adminId: string, dto: AdminCancelRideDto) {
    // Delegate to RideService to maintain state machine and auditing logic
    return this.rideService.cancelRideByAdmin(rideId, adminId, dto.stateVersion, dto.reason);
  }
}
