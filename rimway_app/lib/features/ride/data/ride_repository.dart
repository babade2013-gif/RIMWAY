import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/errors/api_exception.dart';

class ServiceTypeModel {
  final String id;
  final String name;
  final String? description;
  final double baseFare;
  final double perKm;
  final double perMinute;
  final double surgeRate;
  final double minFare;

  const ServiceTypeModel({
    required this.id,
    required this.name,
    this.description,
    required this.baseFare,
    required this.perKm,
    required this.perMinute,
    required this.surgeRate,
    required this.minFare,
  });

  static double _toDouble(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? 0.0;
    return 0.0;
  }

  static int _toInt(dynamic val) {
    if (val == null) return 0;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? 0;
    return 0;
  }

  factory ServiceTypeModel.fromJson(Map<String, dynamic> json) {
    return ServiceTypeModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      baseFare: _toDouble(json['baseFare']),
      perKm: _toDouble(json['perKm']),
      perMinute: _toDouble(json['perMinute']),
      surgeRate: _toDouble(json['surgeRate']),
      minFare: _toDouble(json['minFare']),
    );
  }
}

class RideEstimate {
  final double estimatedFare;
  final int estimatedDurationMinutes;
  final double distanceKm;
  final ServiceTypeModel? serviceType;

  const RideEstimate({
    required this.estimatedFare,
    required this.estimatedDurationMinutes,
    this.distanceKm = 0.0,
    this.serviceType,
  });

  factory RideEstimate.fromJson(Map<String, dynamic> json) {
    return RideEstimate(
      estimatedFare: ServiceTypeModel._toDouble(json['estimatedFare']),
      estimatedDurationMinutes: ServiceTypeModel._toInt(json['estimatedTimeMin'] ?? json['estimatedDurationMinutes']),
      distanceKm: ServiceTypeModel._toDouble(json['distanceKm']),
      serviceType: json['serviceType'] != null
          ? ServiceTypeModel.fromJson(json['serviceType'] as Map<String, dynamic>)
          : null,
    );
  }
}

class RideModel {
  final String id;
  final String status;
  final int stateVersion;
  final double? pickupLat;
  final double? pickupLng;
  final double? dropoffLat;
  final double? dropoffLng;
  final String? pickupAddress;
  final String? dropoffAddress;
  final double? distanceKm;
  final double? fare;
  final String? passengerName;
  final String? passengerPhone;
  final double? estimatedFare;
  final double? finalFare;
  final DateTime? createdAt;
  final String? passengerId;
  final String? customerName;
  final String? customerPhone;

  const RideModel({
    required this.id,
    required this.status,
    required this.stateVersion,
    this.pickupLat,
    this.pickupLng,
    this.dropoffLat,
    this.dropoffLng,
    this.pickupAddress,
    this.dropoffAddress,
    this.distanceKm,
    this.fare,
    this.passengerName,
    this.passengerPhone,
    this.estimatedFare,
    this.finalFare,
    this.createdAt,
    this.passengerId,
    this.customerName,
    this.customerPhone,
  });

  static double? _parseNum(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  factory RideModel.fromJson(Map<String, dynamic> json) {
    return RideModel(
      id: json['id'] as String,
      status: json['status'] as String,
      stateVersion: json['stateVersion'] as int? ?? 1,
      pickupLat: _parseNum(json['pickupLat']),
      pickupLng: _parseNum(json['pickupLng']),
      dropoffLat: _parseNum(json['dropoffLat']),
      dropoffLng: _parseNum(json['dropoffLng']),
      pickupAddress: (json['pickupAddress'] ?? json['pickupName']) as String?,
      dropoffAddress: (json['dropoffAddress'] ?? json['dropoffName']) as String?,
      distanceKm: _parseNum(json['distanceKm']),
      fare: _parseNum(json['fare']),
      passengerName: (json['passengerName'] ?? json['customerName'] ?? (json['passenger'] is Map ? json['passenger']['name'] : null)) as String?,
      passengerPhone: (json['passengerPhone'] ?? json['customerPhone'] ?? (json['passenger'] is Map ? json['passenger']['phone'] : null)) as String?,
      estimatedFare: _parseNum(json['estimatedFare']),
      finalFare: _parseNum(json['finalFare']),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      passengerId: json['passengerId'] as String?,
      customerName: (json['customerName'] ?? json['passengerName'] ?? (json['passenger'] is Map ? json['passenger']['name'] : null)) as String?,
      customerPhone: (json['customerPhone'] ?? json['passengerPhone'] ?? (json['passenger'] is Map ? json['passenger']['phone'] : null)) as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'stateVersion': stateVersion,
      'pickupLat': pickupLat,
      'pickupLng': pickupLng,
      'dropoffLat': dropoffLat,
      'dropoffLng': dropoffLng,
      'pickupAddress': pickupAddress,
      'dropoffAddress': dropoffAddress,
      'pickupName': pickupAddress,
      'dropoffName': dropoffAddress,
      'distanceKm': distanceKm,
      'fare': fare,
      'passengerName': passengerName,
      'passengerPhone': passengerPhone,
      'estimatedFare': estimatedFare,
      'finalFare': finalFare,
      'createdAt': createdAt?.toIso8601String(),
      'passengerId': passengerId,
      'customerName': customerName,
      'customerPhone': customerPhone,
    };
  }

  RideModel copyWith({
    String? status,
    int? stateVersion,
    double? finalFare,
    double? estimatedFare,
    double? fare,
    double? distanceKm,
    String? pickupAddress,
    String? dropoffAddress,
    String? customerName,
    String? customerPhone,
    String? passengerName,
    String? passengerPhone,
  }) {
    return RideModel(
      id: id,
      status: status ?? this.status,
      stateVersion: stateVersion ?? this.stateVersion,
      pickupLat: pickupLat,
      pickupLng: pickupLng,
      dropoffLat: dropoffLat,
      dropoffLng: dropoffLng,
      pickupAddress: pickupAddress ?? this.pickupAddress,
      dropoffAddress: dropoffAddress ?? this.dropoffAddress,
      distanceKm: distanceKm ?? this.distanceKm,
      fare: fare ?? this.fare,
      passengerName: passengerName ?? this.passengerName,
      passengerPhone: passengerPhone ?? this.passengerPhone,
      estimatedFare: estimatedFare ?? this.estimatedFare,
      finalFare: finalFare ?? this.finalFare,
      createdAt: createdAt,
      passengerId: passengerId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
    );
  }
}

class RideRepository {
  final ApiClient apiClient;

  RideRepository({required this.apiClient});

  Future<List<ServiceTypeModel>> getServiceTypes() async {
    try {
      final response = await apiClient.dio.get('/rides/services');
      final list = response.data as List;
      return list.map((e) => ServiceTypeModel.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      throw ApiException.fromError(e);
    }
  }

  Future<RideEstimate> estimateRide({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required String serviceTypeId,
  }) async {
    try {
      final response = await apiClient.dio.post('/rides/estimate', data: {
        'pickupLat': pickupLat,
        'pickupLng': pickupLng,
        'dropoffLat': dropoffLat,
        'dropoffLng': dropoffLng,
        'serviceTypeId': serviceTypeId,
      });
      return RideEstimate.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiException.fromError(e);
    }
  }

  Future<RideModel> requestRide({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required String pickupAddress,
    required String dropoffAddress,
    required String serviceTypeId,
    required String idempotencyKey,
  }) async {
    try {
      final response = await apiClient.dio.post(
        '/rides/request',
        data: {
          'pickupLat': pickupLat,
          'pickupLng': pickupLng,
          'dropoffLat': dropoffLat,
          'dropoffLng': dropoffLng,
          'pickupName': pickupAddress,
          'dropoffName': dropoffAddress,
          'pickupAddress': pickupAddress,
          'dropoffAddress': dropoffAddress,
          'serviceTypeId': serviceTypeId,
        },
        options: Options(
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        ),
      );
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      throw ApiException.fromError(e);
    }
  }

  Future<void> cancelRide({required String rideId}) async {
    try {
      await apiClient.dio.post('/rides/cancel', data: {'rideId': rideId});
    } catch (e) {
      throw ApiException.fromError(e);
    }
  }

  Future<void> rateRide({
    required String rideId,
    required int rating,
    String? comment,
  }) async {
    try {
      await apiClient.dio.post(
        '/rides/$rideId/rate',
        data: {
          'rating': rating,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        },
      );
    } catch (e) {
      throw ApiException.fromError(e);
    }
  }

  Future<RideModel?> getCurrentRide() async {
    try {
      final response = await apiClient.dio.get('/rides/current');
      final data = response.data;
      if (data == null || data['status'] == 'NO_RIDE_FOUND') return null;
      return RideModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return null; // No active ride = null, not an error
    }
  }
}
