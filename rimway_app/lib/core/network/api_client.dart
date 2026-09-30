import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../config/env_config.dart';
import 'auth_interceptor.dart';

class ApiClient {
  late final Dio _dio;
  final SecureStorage _secureStorage;

  ApiClient({required SecureStorage secureStorage}) : _secureStorage = secureStorage {
    _dio = Dio(BaseOptions(
      baseUrl: EnvConfig.instance.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Inject development failover interceptor
    if (EnvConfig.instance.environment == Environment.development) {
      _dio.interceptors.add(DevelopmentHostFailoverInterceptor(dio: _dio));
    }
  }

  void setupAuthInterceptor(VoidCallback onUnauthenticated) {
    _dio.interceptors.add(AuthInterceptor(
      dio: _dio, 
      secureStorage: _secureStorage, 
      onUnauthenticated: onUnauthenticated,
    ));
  }

  Dio get dio => _dio;
}

class DevelopmentHostFailoverInterceptor extends Interceptor {
  final Dio dio;

  DevelopmentHostFailoverInterceptor({required this.dio});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (EnvConfig.instance.environment == Environment.development &&
        (err.type == DioExceptionType.connectionError ||
         err.type == DioExceptionType.connectionTimeout)) {
      final currentBase = dio.options.baseUrl;
      final alternatives = [
        'http://127.0.0.1:3000/api/v1',
        'http://10.37.239.33:3000/api/v1',
      ];

      for (final alt in alternatives) {
        if (alt != currentBase) {
          try {
            final testDio = Dio(BaseOptions(
              baseUrl: alt,
              connectTimeout: const Duration(seconds: 4),
              headers: Map<String, dynamic>.from(err.requestOptions.headers),
            ));
            final response = await testDio.request(
              err.requestOptions.path,
              data: err.requestOptions.data,
              queryParameters: err.requestOptions.queryParameters,
              options: Options(
                method: err.requestOptions.method,
                contentType: err.requestOptions.contentType,
                responseType: err.requestOptions.responseType,
              ),
            );
            dio.options.baseUrl = alt;
            debugPrint('Switched development baseUrl to $alt');
            return handler.resolve(response);
          } catch (_) {}
        }
      }
    }
    return handler.next(err);
  }
}
