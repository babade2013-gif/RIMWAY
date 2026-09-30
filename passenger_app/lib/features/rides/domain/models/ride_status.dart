enum RideStatus {
  SEARCHING,
  DRIVER_ASSIGNED,
  DRIVER_ACCEPTED,
  DRIVER_ARRIVING,
  DRIVER_ARRIVED,
  WAITING_FOR_PASSENGER,
  OTP_VERIFIED,
  IN_PROGRESS,
  COMPLETED,
  CANCELLED_BY_PASSENGER,
  CANCELLED_BY_DRIVER,
  NO_DRIVER_FOUND,
  UNKNOWN
}

extension RideStatusParsing on String {
  RideStatus toRideStatus() {
    return RideStatus.values.firstWhere(
      (e) => e.toString().split('.').last == this,
      orElse: () => RideStatus.UNKNOWN,
    );
  }
}
