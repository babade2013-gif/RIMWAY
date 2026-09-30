import '../../../core/network/api_client.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/secure_storage.dart';
import 'package:dio/dio.dart';

class AuthRepository {
  final ApiClient apiClient;
  final SecureStorage secureStorage;

  AuthRepository({required this.apiClient, required this.secureStorage});

  Future<void> sendOtp(String phone) async {
    try {
      await apiClient.dio.post('/auth/send-otp', data: {
        'phone': phone,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> verifyOtp(String phone, String otp, {String role = 'PASSENGER'}) async {
    try {
      final response = await apiClient.dio.post('/auth/verify-otp', data: {
        'phone': phone,
        'otp': otp,
        'role': role,
      });
      
      final data = response.data;
      if (data['accessToken'] != null && data['refreshToken'] != null) {
        final actualRole = data['role'] ?? role;
        await secureStorage.saveTokens(
          accessToken: data['accessToken'],
          refreshToken: data['refreshToken'],
          role: actualRole,
        );
      }
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> logout() async {
    try {
      final refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken != null) {
        await apiClient.dio.post('/auth/logout', data: {
          'refreshToken': refreshToken,
        });
      }
    } catch (e) {
      // Ignore network errors on logout, just clear local tokens
    } finally {
      await secureStorage.clearTokens();
    }
  }
}
