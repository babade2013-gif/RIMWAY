import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RideStateMachine } from './ride-state.machine';
import { RideStatus, Prisma } from '@prisma/client';
import { PricingService } from '../pricing/pricing.service';
import { RideGateway } from '../events/ride.gateway';
import { DriverService } from '../drivers/driver.service';
import { WalletService } from '../wallet/wallet.service';


@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService, 
    private stateMachine: RideStateMachine,
    private pricingService: PricingService,
    private gateway: RideGateway,
    private driverService: DriverService,
    private walletService: WalletService,
  ) {}

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private calculatePayloadHash(dto: any): string {
    const canonicalPayload = {
      customerName: typeof dto.customerName === 'string' ? dto.customerName.trim() : dto.customerName,
      customerPhone: typeof dto.customerPhone === 'string' ? dto.customerPhone.trim() : dto.customerPhone,
      serviceTypeId: typeof dto.serviceTypeId === 'string' ? dto.serviceTypeId.trim() : dto.serviceTypeId,
      pickupLat: Number(dto.pickupLat),
      pickupLng: Number(dto.pickupLng),
      pickupName: typeof dto.pickupName === 'string' ? dto.pickupName.trim() : dto.pickupName,
      dropoffLat: Number(dto.dropoffLat),
      dropoffLng: Number(dto.dropoffLng),
      dropoffName: typeof dto.dropoffName === 'string' ? dto.dropoffName.trim() : dto.dropoffName,
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async estimateFare(dto: any) {
    if (
      typeof dto.pickupLat !== 'number' || typeof dto.pickupLng !== 'number' ||
      typeof dto.dropoffLat !== 'number' || typeof dto.dropoffLng !== 'number' ||
      isNaN(dto.pickupLat) || isNaN(dto.pickupLng) ||
      isNaN(dto.dropoffLat) || isNaN(dto.dropoffLng) ||
      dto.pickupLat < -90 || dto.pickupLat > 90 ||
      dto.dropoffLat < -90 || dto.dropoffLat > 90 ||
      dto.pickupLng < -180 || dto.pickupLng > 180 ||
      dto.dropoffLng < -180 || dto.dropoffLng > 180
    ) {
      throw new ConflictException('Invalid pickup or dropoff coordinates');
    }

    const serviceType = await this.prisma.serviceType.findUnique({ where: { id: dto.serviceTypeId } });
    if (!serviceType) throw new NotFoundException('Service not found');

    const calculatedDist = this.calculateHaversineDistance(dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng);
    const distanceKm = new Prisma.Decimal(calculatedDist);
    // Since we don't have a real routing API to give us an ETA, we pass 0 for estimatedTimeMin to pricing
    const estimatedTimeMin = new Prisma.Decimal(0); 

    const estimate = this.pricingService.calculateEstimate({
      baseFare: serviceType.baseFare,
      perKm: serviceType.perKm,
      perMinute: serviceType.perMinute,
      surgeRate: serviceType.surgeRate,
      minFare: serviceType.minFare,
      distanceKm,
      estimatedTimeMin
    });
    return { estimatedFare: estimate, distanceKm, estimatedTimeMin, serviceType };
  }

  async requestRide(passengerId: string, dto: any, idempotencyKey: string) {
    const existing = await this.prisma.ride.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.passengerId !== passengerId) throw new ForbiddenException('Idempotency key collision');
      return existing;
    }

    const est = await this.estimateFare(dto);

    const ride = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ride.create({
        data: <any> {
          passengerId,
          serviceTypeId: dto.serviceTypeId,
          idempotencyKey,
          status: RideStatus.SEARCHING,
          pickupLat: dto.pickupLat,
          pickupLng: dto.pickupLng,
          pickupName: dto.pickupName,
          dropoffLat: dto.dropoffLat,
          dropoffLng: dto.dropoffLng,
          dropoffName: dto.dropoffName,
          rideCode: Math.floor(1000 + Math.random() * 9000).toString(),
          snapBaseFare: est.serviceType.baseFare,
          snapPerKm: est.serviceType.perKm,
          snapPerMin: est.serviceType.perMinute,
          snapSurge: est.serviceType.surgeRate,
          snapServiceFee: est.serviceType.serviceFee,
          snapMinFare: est.serviceType.minFare,
          estimatedFare: est.estimatedFare,
          distanceKm: est.distanceKm,
          estimatedTime: est.estimatedTimeMin.toNumber(),
        }
      });
      await tx.auditLog.create({
        data: {
          userId: passengerId,
          action: 'RIDE_REQUESTED',
          entity: 'Ride',
          entityId: created.id,
          newData: { status: RideStatus.SEARCHING, idempotencyKey }
        }
      });
      return created;
    });

    // Start Dispatch Cycle 1
    await this.dispatchCycle(ride.id, 1, ride.pickupLat, ride.pickupLng);

    return ride;
  }

  async createPhoneRide(adminId: string, dto: any, idempotencyKey?: string) {
    let currentPayloadHash: string | undefined;
    
    if (idempotencyKey) {
      currentPayloadHash = this.calculatePayloadHash(dto);
      const existing = await this.prisma.ride.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (!existing.payloadHash) {
          throw new ConflictException('Legacy idempotency record without payloadHash');
        }
        if (existing.payloadHash !== currentPayloadHash) {
          throw new ConflictException('Idempotency-Key has already been used with a different payload');
        }
        return existing;
      }
    }

    const est = await this.estimateFare(dto);
    const finalEstimatedFare = (dto.estimatedFare !== undefined && dto.estimatedFare !== null && !isNaN(Number(dto.estimatedFare)))
      ? new Prisma.Decimal(Number(dto.estimatedFare))
      : est.estimatedFare;
    const finalDistanceKm = (dto.distanceKm !== undefined && dto.distanceKm !== null && !isNaN(Number(dto.distanceKm)))
      ? new Prisma.Decimal(Number(dto.distanceKm))
      : est.distanceKm;

    let ride;
    try {
      ride = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ride.create({
          data: <any> {
            source: 'PHONE_OPERATOR',
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
            serviceTypeId: dto.serviceTypeId,
            idempotencyKey,
            payloadHash: currentPayloadHash,
            status: RideStatus.SEARCHING,
            pickupLat: dto.pickupLat,
            pickupLng: dto.pickupLng,
            pickupName: dto.pickupName,
            dropoffLat: dto.dropoffLat,
            dropoffLng: dto.dropoffLng,
            dropoffName: dto.dropoffName,
            snapBaseFare: est.serviceType.baseFare,
            snapPerKm: est.serviceType.perKm,
            snapPerMin: est.serviceType.perMinute,
            snapSurge: est.serviceType.surgeRate,
            snapServiceFee: est.serviceType.serviceFee,
            snapMinFare: est.serviceType.minFare,
            estimatedFare: finalEstimatedFare,
            distanceKm: finalDistanceKm,
            estimatedTime: est.estimatedTimeMin.toNumber(),
            rideCode: Math.floor(1000 + Math.random() * 9000).toString(),
          }
        });

        await tx.auditLog.create({
          data: {
            userId: adminId,
            action: 'PHONE_RIDE_CREATED',
            entity: 'Ride',
            entityId: created.id,
            newData: { status: RideStatus.SEARCHING, idempotencyKey }
          }
        });
        return created;
      });
    } catch (err: any) {
      if (idempotencyKey && err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey')) {
        const existing = await this.prisma.ride.findUnique({ where: { idempotencyKey } });
        if (existing) {
          if (!existing.payloadHash) {
            throw new ConflictException('Legacy idempotency record without payloadHash');
          }
          if (existing.payloadHash !== currentPayloadHash) {
            throw new ConflictException('Idempotency-Key has already been used with a different payload');
          }
          return existing;
        }
      }
      throw err;
    }

    // Start Dispatch Cycle 1
    await this.dispatchCycle(ride.id, 1, ride.pickupLat, ride.pickupLng);

    return ride;
  }


  async dispatchCycle(rideId: string, cycleId: number, lat: number, lng: number) {
    const initialRadius = parseFloat(process.env.DISPATCH_INITIAL_RADIUS_KM || '5');
    const expansion = parseFloat(process.env.DISPATCH_RADIUS_EXPANSION_KM || '5');
    const topN = parseInt(process.env.DISPATCH_TOP_N || '5', 10);
    const ttl = parseInt(process.env.DISPATCH_CYCLE_TTL_SEC || '30', 10);

    const radius = initialRadius + (cycleId - 1) * expansion;
    
    // Set cycle state in Redis
    const redis = this.driverService.redisClient;
    await redis.hset(`ride_dispatch:${rideId}`, {
      cycle: cycleId,
      expiresAt: Date.now() + ttl * 1000
    });

    const eligibleDrivers = await this.driverService.findNearbyEligibleDrivers(lat, lng, radius, rideId, cycleId, topN);
    
    let rideData: any = null;
    try {
      rideData = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: {
          serviceType: { select: { name: true } },
          passenger: { select: { name: true, phone: true } },
        },
      });
    } catch (_) {}

    const payload = {
      rideId,
      cycleId,
      lat: rideData?.pickupLat ?? lat,
      lng: rideData?.pickupLng ?? lng,
      pickupLat: rideData?.pickupLat ?? lat,
      pickupLng: rideData?.pickupLng ?? lng,
      pickupName: rideData?.pickupName || 'نقطة الانطلاق',
      dropoffLat: rideData?.dropoffLat,
      dropoffLng: rideData?.dropoffLng,
      dropoffName: rideData?.dropoffName || 'وجهة الوصول',
      distanceKm: rideData?.distanceKm ? Number(rideData.distanceKm) : undefined,
      estimatedFare: rideData?.estimatedFare ? Number(rideData.estimatedFare) : undefined,
      estimatedTime: rideData?.estimatedTime,
      customerName: rideData?.customerName || rideData?.passenger?.name || 'الزبون',
      customerPhone: rideData?.customerPhone || rideData?.passenger?.phone,
      serviceName: rideData?.serviceType?.name || 'Standard',
      stateVersion: rideData?.stateVersion ?? 1,
    };

    for (const driverId of eligibleDrivers) {
      this.gateway.server.to(`driver_${driverId}`).emit('ride_requested', payload);
    }
  }

  async getServiceTypes() {
    return this.prisma.serviceType.findMany({
      where: { isActive: true },
      orderBy: { baseFare: 'asc' },
    });
  }

  private formatRideResponse(ride: any) {
    if (!ride || ride.status === 'NO_RIDE_FOUND') return ride;
    return {
      ...ride,
      pickupAddress: ride.pickupName,
      dropoffAddress: ride.dropoffName,
      customerName: ride.customerName || ride.passenger?.name || 'الزبون',
      passengerName: ride.customerName || ride.passenger?.name || 'الزبون',
      customerPhone: ride.customerPhone || ride.passenger?.phone || '',
      passengerPhone: ride.customerPhone || ride.passenger?.phone || '',
      distanceKm: ride.distanceKm != null ? Number(ride.distanceKm) : null,
      estimatedFare: ride.estimatedFare != null ? Number(ride.estimatedFare) : null,
      finalFare: ride.finalFare != null ? Number(ride.finalFare) : null,
    };
  }

  async acceptRide(rideId: string, driverId: string, driverUserId: string, expectedVersion: number) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, status: RideStatus.SEARCHING, stateVersion: expectedVersion },
        data: <any> { driverId, status: RideStatus.DRIVER_ASSIGNED, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('Ride already taken or state mismatch');
      const ride = await tx.ride.findUnique({
        where: { id: rideId },
        include: {
          passenger: { select: { id: true, name: true, phone: true } },
          serviceType: { select: { name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: driverUserId,
          action: 'RIDE_ACCEPTED',
          entity: 'Ride',
          entityId: ride.id,
          newData: { status: RideStatus.DRIVER_ASSIGNED, stateVersion: ride.stateVersion, driverId }
        }
      });
      return this.formatRideResponse(ride);
    });
    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);
    return updated;
  }

  async progressRideStatus(rideId: string, driverUserId: string, nextStatus: RideStatus, expectedVersion: number) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId, driverId: driver.id } });
    if (!ride) throw new ForbiddenException();

    this.stateMachine.validateTransitionOrThrow(ride.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, stateVersion: expectedVersion, driverId: driver.id },
        data: { status: nextStatus, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('State conflict or unauthorized');
      const refreshed = await tx.ride.findUnique({
        where: { id: rideId },
        include: {
          passenger: { select: { id: true, name: true, phone: true } },
          serviceType: { select: { name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: driverUserId,
          action: nextStatus,
          entity: 'Ride',
          entityId: rideId,
          newData: { status: refreshed.status, stateVersion: refreshed.stateVersion }
        }
      });
      return this.formatRideResponse(refreshed);
    });

    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);
    return updated;
  }

  async updateRideStatus(rideId: string, driverUserId: string, currentStatus: RideStatus, nextStatus: RideStatus, expectedVersion: number) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    this.stateMachine.validateTransitionOrThrow(currentStatus, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, driverId: driver.id, status: currentStatus, stateVersion: expectedVersion },
        data: <any> { status: nextStatus, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('State conflict or unauthorized');
      const refreshed = await tx.ride.findUnique({
        where: { id: rideId },
        include: {
          passenger: { select: { id: true, name: true, phone: true } },
          serviceType: { select: { name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: driverUserId,
          action: nextStatus,
          entity: 'Ride',
          entityId: rideId,
          newData: { status: refreshed.status, stateVersion: refreshed.stateVersion }
        }
      });
      return this.formatRideResponse(refreshed);
    });

    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);
    return updated;
  }

  async cancelRide(rideId: string, passengerId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.passengerId !== passengerId) throw new ForbiddenException();
    this.stateMachine.validateTransitionOrThrow(ride.status, RideStatus.CANCELLED_BY_PASSENGER);
    
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, status: ride.status, stateVersion: ride.stateVersion },
        data: <any> { status: RideStatus.CANCELLED_BY_PASSENGER, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('Cancellation conflict');
      const refreshed = await tx.ride.findUnique({ where: { id: rideId } });
      await tx.auditLog.create({
        data: {
          userId: passengerId,
          action: 'RIDE_CANCELLED',
          entity: 'Ride',
          entityId: rideId,
          newData: { status: refreshed.status, stateVersion: refreshed.stateVersion }
        }
      });
      return refreshed;
    });

    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);
    return updated;
  }

  /**
   * Dedicated completion path: atomic state transition + financial settlement.
   * 
   * Only IN_PROGRESS → COMPLETED is allowed.
   * finalFare is calculated from the Ride's historical pricing snapshots.
   * Commission, wallet credit, and ledger entries are all committed in one transaction.
   */
  async completeRide(rideId: string, driverUserId: string, expectedVersion: number) {
    // 1. Resolve driver and verify ownership outside the write transaction
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Driver profile not found');

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.driverId !== driver.id) throw new ForbiddenException('Not assigned to this ride');

    // 2. Validate state machine transition
    this.stateMachine.validateTransitionOrThrow(ride.status, RideStatus.COMPLETED);

    // 3. Calculate finalFare from historical snapshots using the existing PricingService formula
    const distanceKm = ride.distanceKm ?? new Prisma.Decimal(0);
    const estimatedTimeMin = new Prisma.Decimal(ride.estimatedTime ?? 0);
    const snapMinFare = ride.snapMinFare ?? new Prisma.Decimal(0);

    const finalFare = this.pricingService.calculateEstimate({
      baseFare: ride.snapBaseFare,
      perKm: ride.snapPerKm,
      perMinute: ride.snapPerMin,
      surgeRate: ride.snapSurge,
      minFare: snapMinFare,
      distanceKm,
      estimatedTimeMin,
      // No discount — PromoCode is not part of the current authoritative finalFare flow
    });

    // 4. Atomic transaction: state change + finalFare + financial settlement + audit
    const updated = await this.prisma.$transaction(async (tx) => {
      // 4a. Atomic state transition with stateVersion guard
      const result = await tx.ride.updateMany({
        where: {
          id: rideId,
          driverId: driver.id,
          status: RideStatus.IN_PROGRESS,
          stateVersion: expectedVersion,
        },
        data: <any>{
          status: RideStatus.COMPLETED,
          finalFare,
          stateVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException('State conflict, unauthorized, or already completed');
      }

      // 4b. Financial settlement (wallet + ledger)
      //     Uses snapServiceFee as the commission percentage
      const settlement = await this.walletService.settleRideFinancials(
        tx,
        rideId,
        driver.id,
        finalFare,
        ride.snapServiceFee,
      );

      // 4c. Financial AuditLog
      const refreshed = await tx.ride.findUnique({ where: { id: rideId } });
      await tx.auditLog.create({
        data: {
          userId: driverUserId,
          action: 'RIDE_COMPLETED',
          entity: 'Ride',
          entityId: rideId,
          newData: {
            status: RideStatus.COMPLETED,
            stateVersion: refreshed.stateVersion,
            finalFare: finalFare.toString(),
            commissionAmount: settlement.commissionAmount.toString(),
            netEarnings: settlement.netEarnings.toString(),
            driverId: driver.id,
          },
          reason: `Settlement: fare=${finalFare}, commission=${settlement.commissionAmount}, net=${settlement.netEarnings}`,
        },
      });

      return refreshed;
    });

    // 5. Emit websocket event outside the transaction
    this.gateway.emitRideStatusChanged(
      updated.id,
      updated.passengerId,
      updated.status,
      updated.stateVersion,
      updated.driverId ?? undefined,
    );

    return updated;
  }


  async getCurrentRide(passengerId: string) {
    if (!passengerId) throw new ForbiddenException('Invalid user');
    const ride = await this.prisma.ride.findFirst({
      where: {
        passengerId,
        status: {
          notIn: [RideStatus.COMPLETED, RideStatus.CANCELLED_BY_PASSENGER, RideStatus.CANCELLED_BY_DRIVER, RideStatus.CANCELLED_BY_ADMIN, RideStatus.NO_DRIVER_FOUND]
        }
      }
    });
    return ride || { status: 'NO_RIDE_FOUND' };
  }

  async getDriverCurrentRide(driverUserId: string) {
    if (!driverUserId) throw new ForbiddenException('Invalid user');
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Driver profile not found');

    const ride = await this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, RideStatus.PASSENGER_BOARDED, RideStatus.IN_PROGRESS]
        }
      }
    });
    if (!ride) return { status: 'NO_RIDE_FOUND' };

    let passenger: any = null;
    if (ride.passengerId && !ride.customerPhone) {
      try {
        passenger = await this.prisma.user.findUnique({ where: { id: ride.passengerId } });
      } catch (_) {}
    }
    return this.formatRideResponse({ ...ride, passenger });
  }

  async cancelRideByDriver(rideId: string, driverUserId: string, expectedVersion: number, reason?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Driver profile not found');

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.driverId !== driver.id) throw new ForbiddenException('Unauthorized');

    // Only allow driver cancellation if status is ASSIGNED or ARRIVED
    if (ride.status !== RideStatus.DRIVER_ASSIGNED && ride.status !== RideStatus.DRIVER_ARRIVED) {
      throw new ConflictException('Cannot cancel ride in current state');
    }

    this.stateMachine.validateTransitionOrThrow(ride.status, RideStatus.CANCELLED_BY_DRIVER);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, driverId: driver.id, status: ride.status, stateVersion: expectedVersion },
        data: <any>{ status: RideStatus.CANCELLED_BY_DRIVER, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('Cancellation conflict');
      
      const refreshed = await tx.ride.findUnique({ where: { id: rideId } });
      await tx.auditLog.create({
        data: {
          userId: driverUserId,
          action: 'RIDE_CANCELLED',
          entity: 'Ride',
          entityId: rideId,
          reason: reason || 'ألغيت بواسطة الكابتن',
          newData: { status: refreshed.status, stateVersion: refreshed.stateVersion, reason }
        }
      });
      return refreshed;
    });

    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);

    // Auto re-dispatch: create a new ride continuation so another captain (or even the same captain) can take it
    try {
      const reDispatchedRide = await this.prisma.ride.create({
        data: <any>{
          source: updated.source,
          customerName: updated.customerName,
          customerPhone: updated.customerPhone,
          passengerId: updated.passengerId,
          serviceTypeId: updated.serviceTypeId,
          status: RideStatus.SEARCHING,
          pickupLat: updated.pickupLat,
          pickupLng: updated.pickupLng,
          pickupName: updated.pickupName,
          dropoffLat: updated.dropoffLat,
          dropoffLng: updated.dropoffLng,
          dropoffName: updated.dropoffName,
          snapBaseFare: updated.snapBaseFare,
          snapPerKm: updated.snapPerKm,
          snapPerMin: updated.snapPerMin,
          snapSurge: updated.snapSurge,
          snapServiceFee: updated.snapServiceFee,
          snapMinFare: updated.snapMinFare,
          estimatedFare: updated.estimatedFare,
          distanceKm: updated.distanceKm,
          estimatedTime: updated.estimatedTime,
          rideCode: Math.floor(1000 + Math.random() * 9000).toString(),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: driverUserId,
          action: 'RIDE_RE_DISPATCHED',
          entity: 'Ride',
          entityId: reDispatchedRide.id,
          reason: `Auto re-dispatch after driver cancellation of ride ${rideId}`,
          newData: { previousRideId: rideId, newRideId: reDispatchedRide.id, driverId: driver.id }
        }
      });

      // Dispatch cycle 1 for the re-dispatched ride
      await this.dispatchCycle(reDispatchedRide.id, 1, reDispatchedRide.pickupLat, reDispatchedRide.pickupLng);
    } catch (reDispatchErr) {
      console.error('Failed to auto re-dispatch ride:', reDispatchErr);
    }

    return updated;
  }

  async cancelRideByAdmin(rideId: string, adminId: string, expectedVersion: number, reason?: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');

    this.stateMachine.validateTransitionOrThrow(ride.status, RideStatus.CANCELLED_BY_ADMIN);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: { id: rideId, status: ride.status, stateVersion: expectedVersion },
        data: <any>{ status: RideStatus.CANCELLED_BY_ADMIN, stateVersion: { increment: 1 } }
      });
      if (result.count === 0) throw new ConflictException('Cancellation conflict');
      
      const refreshed = await tx.ride.findUnique({ where: { id: rideId } });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'ADMIN_RIDE_CANCELLED',
          entity: 'Ride',
          entityId: rideId,
          reason,
          oldData: { status: ride.status },
          newData: { status: RideStatus.CANCELLED_BY_ADMIN, stateVersion: refreshed.stateVersion }
        }
      });
      return refreshed;
    });

    this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion, updated.driverId ?? undefined);
    return updated;
  }

  async rateRide(rideId: string, passengerId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be between 1 and 5');
    
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.passengerId !== passengerId) throw new BadRequestException('Not your ride');
    if (ride.status !== RideStatus.COMPLETED) throw new BadRequestException('Ride not completed');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.rating.findUnique({
        where: { rideId_passengerId: { rideId, passengerId } }
      });
      if (existing) throw new BadRequestException('Ride already rated');

      const created = await tx.rating.create({
        data: {
          rideId,
          passengerId,
          driverId: ride.driverId!,
          rating,
          comment
        }
      });

      // Update aggregate rating atomically
      const aggregations = await tx.rating.aggregate({
        where: { driverId: ride.driverId! },
        _avg: { rating: true }
      });
      
      const avg = aggregations._avg.rating || 5;
      
      await tx.driver.update({
        where: { id: ride.driverId! },
        data: { rating: avg }
      });

      return created;
    });
  }

  async getDriverRideHistory(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const rides = await this.prisma.ride.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      include: {
        serviceType: { select: { name: true } },
      },
    });

    const cancelledIds = rides.filter(r => r.status && r.status.includes('CANCEL')).map(r => r.id);
    let cancelLogs: any[] = [];
    if (cancelledIds.length > 0) {
      cancelLogs = await this.prisma.auditLog.findMany({
        where: {
          entity: 'Ride',
          entityId: { in: cancelledIds },
          action: { in: ['RIDE_CANCELLED', 'RIDE_CANCELLED_BY_DRIVER', 'ADMIN_RIDE_CANCELLED'] }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    const cancelMap = new Map<string, string>();
    for (const log of cancelLogs) {
      if (!cancelMap.has(log.entityId) && log.reason) {
        cancelMap.set(log.entityId, log.reason);
      }
    }

    return rides.map(r => ({
      ...r,
      cancelReason: cancelMap.get(r.id) || null,
      distanceKm: r.distanceKm != null ? Number(r.distanceKm) : null,
      estimatedFare: r.estimatedFare != null ? Number(r.estimatedFare) : null,
      finalFare: r.finalFare != null ? Number(r.finalFare) : null,
    }));
  }
}
