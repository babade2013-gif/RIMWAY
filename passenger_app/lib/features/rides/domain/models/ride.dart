import 'ride_status.dart';

class Ride {
  final String id;
  final RideStatus status;
  final int stateVersion;
  final String? driverId;
  final double estimatedFare;
  final DateTime updatedAt;

  Ride({
    required this.id,
    required this.status,
    required this.stateVersion,
    this.driverId,
    required this.estimatedFare,
    required this.updatedAt,
  });

  factory Ride.fromJson(Map<String, dynamic> json) {
    return Ride(
      id: json['id'] as String,
      status: (json['status'] as String).toRideStatus(),
      stateVersion: json['stateVersion'] as int,
      driverId: json['driverId'] as String?,
      estimatedFare: (json['estimatedFare'] as num).toDouble(),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}
