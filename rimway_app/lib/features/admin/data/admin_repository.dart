import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../ride/data/ride_repository.dart';

class AdminRepository {
  final ApiClient apiClient;

  AdminRepository({required this.apiClient});

  Future<List<RideModel>> getRides() async {
    try {
      final response = await apiClient.dio.get('/admin/rides');
      final data = response.data as List;
      return data.map((json) => RideModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> getRideDetails(String rideId) async {
    try {
      final response = await apiClient.dio.get('/admin/rides/$rideId');
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> createPhoneRide({
    required String customerName,
    required String customerPhone,
    required double pickupLat,
    required double pickupLng,
    required String pickupName,
    required double dropoffLat,
    required double dropoffLng,
    required String dropoffName,
    required String serviceTypeId,
  }) async {
    try {
      final response = await apiClient.dio.post('/admin/rides', data: {
        'customerName': customerName,
        'customerPhone': customerPhone,
        'pickupLat': pickupLat,
        'pickupLng': pickupLng,
        'pickupName': pickupName,
        'dropoffLat': dropoffLat,
        'dropoffLng': dropoffLng,
        'dropoffName': dropoffName,
        'serviceTypeId': serviceTypeId,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> cancelRide({
    required String rideId,
    required int stateVersion,
    String? reason,
  }) async {
    try {
      final response = await apiClient.dio.post('/admin/rides/$rideId/cancel', data: {
        'stateVersion': stateVersion,
        if (reason != null) 'reason': reason,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
