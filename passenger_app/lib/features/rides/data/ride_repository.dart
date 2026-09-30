import 'package:dio/dio.dart';
import '../domain/models/ride.dart';

class RideRepository {
  final Dio _dio;
  
  RideRepository(this._dio);

  Future<Map<String, dynamic>> estimateFare(double pickupLat, double pickupLng, double dropoffLat, double dropoffLng, String serviceTypeId) async {
    final response = await _dio.post('/rides/estimate', data: {
      'pickupLat': pickupLat,
      'pickupLng': pickupLng,
      'dropoffLat': dropoffLat,
      'dropoffLng': dropoffLng,
      'serviceTypeId': serviceTypeId,
    });
    return response.data;
  }

  // Idempotency handled purely via the passed key to survive retries cleanly
  Future<Ride> requestRide(Map<String, dynamic> payload, String idempotencyKey) async {
    final response = await _dio.post(
      '/rides/request', 
      data: payload,
      options: Options(headers: {'Idempotency-Key': idempotencyKey}),
    );
    return Ride.fromJson(response.data);
  }

  Future<Ride?> getCurrentRide() async {
    try {
      final response = await _dio.get('/rides/current');
      if (response.data == null) return null;
      return Ride.fromJson(response.data);
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<void> cancelRide(String rideId) async {
    await _dio.post('/rides/cancel', data: {'rideId': rideId});
  }
}
