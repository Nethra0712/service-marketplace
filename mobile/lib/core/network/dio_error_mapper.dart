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
      return _fromResponse(e);
    case DioExceptionType.unknown:
      return UnknownException('Unexpected network error.', cause: e);
  }
}

AppException _fromResponse(DioException cause) {
  final statusCode = cause.response?.statusCode;
  final code = _errorCode(cause.response?.data);

  if (statusCode == null) {
    return UnknownException(
      'Response had no status code.',
      cause: cause,
      code: code,
    );
  }
  if (statusCode == 401) {
    return UnauthorizedException('Unauthorized.', cause: cause, code: code);
  }
  if (statusCode == 403) {
    return ForbiddenException('Forbidden.', cause: cause, code: code);
  }
  if (statusCode == 404) {
    return NotFoundException('Not found.', cause: cause, code: code);
  }
  if (statusCode >= 500) {
    return ServerException(
      'Server error ($statusCode).',
      statusCode: statusCode,
      cause: cause,
      code: code,
    );
  }
  return ApiException(
    'Request failed ($statusCode).',
    statusCode: statusCode,
    retryAfterSeconds: _retryAfterSeconds(cause.response),
    cause: cause,
    code: code,
  );
}

/// Reads `error.code` from the backend's standard error body
/// `{ "error": { "code": "...", "message": "..." } }`. Anything else is null.
String? _errorCode(Object? body) {
  if (body is! Map<String, dynamic>) return null;
  final error = body['error'];
  if (error is! Map<String, dynamic>) return null;
  final code = error['code'];
  return code is String ? code : null;
}

int? _retryAfterSeconds(Response<dynamic>? response) {
  final value = response?.headers.value('retry-after');
  return value == null ? null : int.tryParse(value);
}
