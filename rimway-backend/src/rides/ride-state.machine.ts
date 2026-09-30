import { BadRequestException, Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

@Injectable()
export class RideStateMachine {
  private static readonly transitions: Record<RideStatus, RideStatus[]> = {
    [RideStatus.SEARCHING]: [RideStatus.DRIVER_ASSIGNED, RideStatus.CANCELLED_BY_PASSENGER, RideStatus.CANCELLED_BY_ADMIN, RideStatus.NO_DRIVER_FOUND],
    [RideStatus.DRIVER_ASSIGNED]: [RideStatus.DRIVER_ARRIVED, RideStatus.CANCELLED_BY_PASSENGER, RideStatus.CANCELLED_BY_DRIVER, RideStatus.CANCELLED_BY_ADMIN],
    [RideStatus.DRIVER_ARRIVED]: [RideStatus.PASSENGER_BOARDED, RideStatus.CANCELLED_BY_PASSENGER, RideStatus.CANCELLED_BY_DRIVER, RideStatus.CANCELLED_BY_ADMIN],
    [RideStatus.PASSENGER_BOARDED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED_BY_ADMIN],
    [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED_BY_ADMIN],
    [RideStatus.COMPLETED]: [],
    [RideStatus.CANCELLED_BY_PASSENGER]: [],
    [RideStatus.CANCELLED_BY_DRIVER]: [],
    [RideStatus.CANCELLED_BY_ADMIN]: [],
    [RideStatus.NO_DRIVER_FOUND]: [],
    // Legacy / Unused states in this phase
    [RideStatus.DRIVER_ARRIVING]: [],
    [RideStatus.WAITING_FOR_PASSENGER]: []
  };

  public canTransition(currentStatus: RideStatus, nextStatus: RideStatus): boolean {
    const allowed = RideStateMachine.transitions[currentStatus];
    return allowed?.includes(nextStatus) ?? false;
  }

  public validateTransitionOrThrow(currentStatus: RideStatus, nextStatus: RideStatus): void {
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new BadRequestException(`Invalid ride state transition from ${currentStatus} to ${nextStatus}`);
    }
  }
}
