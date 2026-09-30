import { RideStateMachine } from './ride-state.machine';
import { RideStatus } from '@prisma/client';

describe('RideStateMachine', () => {
  let sm: RideStateMachine;

  beforeEach(() => {
    sm = new RideStateMachine();
  });

  it('should allow valid transition from SEARCHING to DRIVER_ASSIGNED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.SEARCHING, RideStatus.DRIVER_ASSIGNED)).not.toThrow();
  });

  it('should allow valid transition from DRIVER_ASSIGNED to DRIVER_ARRIVED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED)).not.toThrow();
  });

  it('should allow valid transition from DRIVER_ARRIVED to PASSENGER_BOARDED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.DRIVER_ARRIVED, RideStatus.PASSENGER_BOARDED)).not.toThrow();
  });

  it('should allow valid transition from PASSENGER_BOARDED to IN_PROGRESS', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.PASSENGER_BOARDED, RideStatus.IN_PROGRESS)).not.toThrow();
  });

  it('should allow valid transition from IN_PROGRESS to COMPLETED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.IN_PROGRESS, RideStatus.COMPLETED)).not.toThrow();
  });

  it('should reject invalid transition from COMPLETED to IN_PROGRESS', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.COMPLETED, RideStatus.IN_PROGRESS)).toThrow();
  });

  it('should reject invalid skip from DRIVER_ASSIGNED to IN_PROGRESS', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.DRIVER_ASSIGNED, RideStatus.IN_PROGRESS)).toThrow();
  });

  it('should allow Admin cancellation from PASSENGER_BOARDED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.PASSENGER_BOARDED, RideStatus.CANCELLED_BY_ADMIN)).not.toThrow();
  });

  it('should reject Passenger cancellation from PASSENGER_BOARDED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.PASSENGER_BOARDED, RideStatus.CANCELLED_BY_PASSENGER)).toThrow();
  });

  it('should reject Driver cancellation from PASSENGER_BOARDED', () => {
    expect(() => sm.validateTransitionOrThrow(RideStatus.PASSENGER_BOARDED, RideStatus.CANCELLED_BY_DRIVER)).toThrow();
  });
});
