class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final String? errorType;

  ApiException({this.statusCode, required this.message, this.errorType});

  factory ApiException.fromError(dynamic error) {
    if (error is ApiException) return error;
    try {
      // Try Dio error handling
      return ApiException.fromDioError(error);
    } catch (_) {
      return ApiException(message: error.toString(), errorType: 'UNKNOWN_ERROR');
    }
  }

  factory ApiException.fromDioError(dynamic dioError) {
    // Mapping from backend error contract
    if (dioError.response != null) {
      final data = dioError.response.data;
      return ApiException(
        statusCode: dioError.response.statusCode,
        message: data['message'] ?? 'Unknown API Error',
        errorType: data['error'] ?? 'API_ERROR',
      );
    }
    return ApiException(message: 'Network connection failed', errorType: 'NETWORK_ERROR');
  }

  @override
  String toString() => 'ApiException(code: $statusCode, message: $message, type: $errorType)';
}
