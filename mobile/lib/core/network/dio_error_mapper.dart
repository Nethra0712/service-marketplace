import 'package:dio/dio.dart';
import 'package:mobile/core/errors/app_exception.dart';

/// Translates a [DioException] into the app's own [AppException] hierarchy.
AppException mapDioException(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.transformTimeout:
      return NetworkTimeoutException('Request timed out.', cause: e);
    case DioExceptionType.connectionError:
    case DioExceptionType.badCertificate:
      return NetworkException('Could not reach the server.', cause: e);
    case DioExceptionType.cancel:
      return RequestCancelledException('Request was cancelled.', cause: e);
    case DioExceptionType.badResponse:
      return _fromStatusCode(e.response?.statusCode, e);
    case DioExceptionType.unknown:
      return UnknownException('Unexpected network error.', cause: e);
  }
}

AppException _fromStatusCode(int? statusCode, DioException cause) {
  if (statusCode == null) {
    return UnknownException('Response had no status code.', cause: cause);
  }
  if (statusCode == 401) {
    return UnauthorizedException('Unauthorized.', cause: cause);
  }
  if (statusCode == 403) return ForbiddenException('Forbidden.', cause: cause);
  if (statusCode == 404) return NotFoundException('Not found.', cause: cause);
  if (statusCode >= 500) {
    return ServerException(
      'Server error ($statusCode).',
      statusCode: statusCode,
      cause: cause,
    );
  }
  return ApiException(
    'Request failed ($statusCode).',
    statusCode: statusCode,
    cause: cause,
  );
}
