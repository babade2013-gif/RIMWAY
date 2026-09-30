import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RideStatus } from '@prisma/client';
import { RideGateway } from '../events/ride.gateway';
import { RideService } from './ride.service';
import { DriverService } from '../drivers/driver.service';

@Injectable()
export class RideTimeoutService {
  private readonly logger = new Logger(RideTimeoutService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RideGateway,
    private readonly rideService: RideService,
    private readonly driverService: DriverService
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleRideTimeouts() {
    const searchingRides = await this.prisma.ride.findMany({
      where: { status: RideStatus.SEARCHING },
      select: { id: true, passengerId: true, stateVersion: true, pickupLat: true, pickupLng: true }
    });

    const redis = this.driverService.redisClient;
    const maxCycles = parseInt(process.env.DISPATCH_MAX_CYCLES || '3', 10);
    const ttl = parseInt(process.env.DISPATCH_CYCLE_TTL_SEC || '30', 10);
    const now = Date.now();

    for (const ride of searchingRides) {
      try {
        const dispatchState = await redis.hgetall(`ride_dispatch:${ride.id}`);
        
        let shouldFail = false;
        let shouldAdvanceCycle = false;
        let currentCycle = 1;

        if (!dispatchState || !dispatchState.cycle) {
          // Fallback if Redis data is missing
          shouldFail = true;
        } else {
          currentCycle = parseInt(dispatchState.cycle, 10);
          const expiresAt = parseInt(dispatchState.expiresAt, 10);

          if (now >= expiresAt) {
            if (currentCycle >= maxCycles) {
              shouldFail = true;
            } else {
              shouldAdvanceCycle = true;
            }
          }
        }

        if (shouldFail) {
          const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.ride.updateMany({
              where: { id: ride.id, status: RideStatus.SEARCHING, stateVersion: ride.stateVersion },
              data: { status: RideStatus.NO_DRIVER_FOUND, stateVersion: { increment: 1 } }
            });
            if (result.count === 0) return null;
            const updatedRide = await tx.ride.findUnique({ where: { id: ride.id } });
            await tx.auditLog.create({
              data: { userId: 'SYSTEM', action: 'DISPATCH_TIMEOUT', entity: 'Ride', entityId: ride.id, newData: { status: RideStatus.NO_DRIVER_FOUND, stateVersion: updatedRide.stateVersion } }
            });
            return updatedRide;
          });

          if (updated) {
            this.logger.log(`Ride ${ride.id} failed after max cycles.`);
            this.gateway.emitRideStatusChanged(updated.id, updated.passengerId, updated.status, updated.stateVersion);
          }
        } else if (shouldAdvanceCycle) {
          // Atomic cycle increment using Lua
          const luaScript = `
            local key = KEYS[1]
            local expected_cycle = tonumber(ARGV[1])
            local current_cycle = tonumber(redis.call('HGET', key, 'cycle'))
            if current_cycle == expected_cycle then
              local next_cycle = expected_cycle + 1
              local expires_at = ARGV[2]
              redis.call('HSET', key, 'cycle', next_cycle, 'expiresAt', expires_at)
              return 1
            end
            return 0
          `;
          
          const nextCycleExpected = currentCycle + 1;
          const newExpiresAt = now + (ttl * 1000);
          
          const result = await redis.eval(
            luaScript, 
            1, 
            `ride_dispatch:${ride.id}`, 
            currentCycle, 
            newExpiresAt
          );

          if (result === 1) {
            this.logger.log(`Ride ${ride.id} advancing to cycle ${nextCycleExpected}`);
            await this.rideService.dispatchCycle(ride.id, nextCycleExpected, ride.pickupLat, ride.pickupLng);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process dispatch cycle for ride ${ride.id}`, error);
      }
    }
  }
}
