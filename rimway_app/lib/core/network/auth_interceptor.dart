import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import '../storage/secure_storage.dart';
import '../config/env_config.dart';

class AuthInterceptor extends Interceptor {
  final Dio dio;
  final SecureStorage secureStorage;
  final VoidCallback? onUnauthenticated;
  bool _isRefreshing = false;
  
  AuthInterceptor({required this.dio, required this.secureStorage, this.onUnauthenticated});

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await secureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      final refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken != null) {
        _isRefreshing = true;
        try {
          // Dedicated refresh dio to prevent interceptor loops
          final refreshDio = Dio(BaseOptions(baseUrl: EnvConfig.instance.apiBaseUrl));
          final response = await refreshDio.post('/auth/refresh', data: {
            'refreshToken': refreshToken,
          });

          if (response.statusCode == 200) {
            final newAccess = response.data['accessToken'];
            final newRefresh = response.data['refreshToken'];
            
            await secureStorage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);
            
            // Retry the original request
            err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
            final retryResponse = await refreshDio.request(
              err.requestOptions.path,
              options: Options(
                method: err.requestOptions.method,
                headers: err.requestOptions.headers,
              ),
              data: err.requestOptions.data,
              queryParameters: err.requestOptions.queryParameters,
            );
            
            _isRefreshing = false;
            return handler.resolve(retryResponse);
          }
        } catch (e) {
          // Refresh failed
          await secureStorage.clearTokens();
          onUnauthenticated?.call();
          // Broadcast unauthenticated state to the app (e.g. via Stream or Navigation injection)
        } finally {
          _isRefreshing = false;
        }
      } else {
        await secureStorage.clearTokens();
        onUnauthenticated?.call();
      }
    }
    return handler.next(err);
  }
}
