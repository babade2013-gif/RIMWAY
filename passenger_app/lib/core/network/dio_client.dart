import 'dart:math';
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../storage/secure_storage.dart';
import '../errors/api_exception.dart';

class DioClient {
  late final Dio dio;
  final SecureStorage secureStorage;
  bool _isRefreshing = false;
  final List<void Function(String)> _tokenRefreshQueue = [];

  DioClient({required this.secureStorage}) {
    dio = Dio(BaseOptions(
      // Environment-based Base URL
      baseUrl: const String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000/api/v1'),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await secureStorage.readAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        
        // Inject Idempotency-Key for Mutating Requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].contains(options.method.toUpperCase())) {
          if (!options.headers.containsKey('Idempotency-Key')) {
            options.headers['Idempotency-Key'] = const Uuid().v4();
          }
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        // Handle 401 Token Refresh Lock
        if (e.response?.statusCode == 401) {
           // Queue logic to refresh token once and retry queued requests
        }

        // Handle Weak Network (Exponential Backoff with Jitter)
        if (_isNetworkError(e) || (e.response?.statusCode ?? 0) >= 500) {
           final shouldRetry = await _retryWithBackoff(e.requestOptions);
           if (shouldRetry != null) return handler.resolve(shouldRetry);
        }

        return handler.next(_mapError(e));
      }
    ));
  }

  bool _isNetworkError(DioException e) {
    return e.type == DioExceptionType.connectionTimeout ||
           e.type == DioExceptionType.receiveTimeout ||
           e.type == DioExceptionType.unknown;
  }

  Future<Response?> _retryWithBackoff(RequestOptions requestOptions) async {
    int currentRetry = requestOptions.extra['retry_count'] ?? 0;
    if (currentRetry >= 3) return null; // Max 3 retries

    currentRetry++;
    requestOptions.extra['retry_count'] = currentRetry;

    // Exponential backoff: 1s, 2s, 4s + random Jitter (0-500ms)
    final delay = pow(2, currentRetry - 1) * 1000 + Random().nextInt(500);
    await Future.delayed(Duration(milliseconds: delay.toInt()));

    return dio.fetch(requestOptions);
  }

  DioException _mapError(DioException e) {
    // Map HTTP codes to Domain Exceptions
    if (e.response != null) {
      final code = e.response!.statusCode;
      if (code == 409) return DioException(requestOptions: e.requestOptions, error: ConflictException());
      if (code == 422) return DioException(requestOptions: e.requestOptions, error: ValidationException());
      if (code == 429) return DioException(requestOptions: e.requestOptions, error: RateLimitException());
    }
    return e;
  }
}
