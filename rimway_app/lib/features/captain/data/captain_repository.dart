import '../../../core/network/api_client.dart';
import '../../../core/errors/api_exception.dart';
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart';
import '../../ride/data/ride_repository.dart';

class CaptainRepository {
  final ApiClient apiClient;

  CaptainRepository({required this.apiClient});

  Future<void> setStatus(bool isOnline) async {
    try {
      await apiClient.dio.post('/drivers/status', data: {
        'isOnline': isOnline,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> updateLocation(double latitude, double longitude) async {
    try {
      await apiClient.dio.post('/drivers/location', data: {
        'latitude': latitude,
        'longitude': longitude,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
  Future<RideModel> acceptRide(String rideId, int expectedVersion) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/accept', data: {
        'stateVersion': expectedVersion,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> arriveAtPickup(String rideId, int expectedVersion) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/arrive', data: {
        'stateVersion': expectedVersion,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> passengerBoarded(String rideId, int expectedVersion) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/boarded', data: {
        'stateVersion': expectedVersion,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> startRide(String rideId, int expectedVersion) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/start', data: {
        'stateVersion': expectedVersion,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> completeRide(String rideId, int expectedVersion) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/complete', data: {
        'stateVersion': expectedVersion,
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel> cancelRide(String rideId, int expectedVersion, {String? reason}) async {
    try {
      final response = await apiClient.dio.post('/drivers/rides/$rideId/cancel', data: {
        'stateVersion': expectedVersion,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      });
      return RideModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<RideModel?> getCurrentRide() async {
    try {
      final response = await apiClient.dio.get('/drivers/rides/current');
      final data = response.data;
      if (data == null || data['status'] == 'NO_RIDE_FOUND') return null;
      return RideModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    try {
      final response = await apiClient.dio.get('/drivers/me');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> uploadFile(String filePath, {String category = 'documents'}) async {
    try {
      final fileName = filePath.split(RegExp(r'[/\\]')).last;
      final ext = fileName.split('.').last.toLowerCase();
      MediaType mediaType;
      if (ext == 'png') {
        mediaType = MediaType('image', 'png');
      } else if (ext == 'webp') {
        mediaType = MediaType('image', 'webp');
      } else if (ext == 'pdf') {
        mediaType = MediaType('application', 'pdf');
      } else {
        mediaType = MediaType('image', 'jpeg');
      }

      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          filePath,
          filename: fileName,
          contentType: mediaType,
        ),
      });
      final response = await apiClient.dio.post(
        '/drivers/upload?category=$category',
        data: formData,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> submitRegistration(Map<String, dynamic> payload) async {
    try {
      final response = await apiClient.dio.post('/drivers/register', data: payload);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<ServiceTypeModel>> getServices() async {
    try {
      final response = await apiClient.dio.get('/rides/services');
      final list = response.data as List<dynamic>;
      return list.map((item) => ServiceTypeModel.fromJson(item as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getWallet() async {
    try {
      final response = await apiClient.dio.get('/drivers/wallet');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> requestTopUp(double amount, {String? reference, String? notes}) async {
    try {
      final response = await apiClient.dio.post('/drivers/wallet/top-up', data: {
        'amount': amount,
        if (reference != null && reference.isNotEmpty) 'reference': reference,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<dynamic>> getWalletTransactions() async {
    try {
      final response = await apiClient.dio.get('/drivers/wallet/transactions');
      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}
