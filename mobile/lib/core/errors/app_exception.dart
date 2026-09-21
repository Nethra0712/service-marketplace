/// Errors surfaced by the data layer.
///
/// Repositories throw these instead of leaking `DioException` or platform
/// exceptions, so state and UI code never depend on a networking library.
sealed class AppException implements Exception {
  const AppException(this.message, {this.cause, this.code});

  /// Developer-facing description. Never shown to users directly: the UI maps
  /// the exception type (and [code]) to a localized message.
  final String message;

  /// The underlying error, kept for logging.
  final Object? cause;

  /// The backend's stable machine-readable error code (for example
  /// `INVALID_OTP`), when the server sent one.
  final String? code;

  @override
  String toString() => '$runtimeType: $message';
}

/// The device could not reach the server (offline, DNS, TLS, refused).
final class NetworkException extends AppException {
  const NetworkException(super.message, {super.cause, super.code});
}

/// The request exceeded a connect/send/receive timeout.
final class NetworkTimeoutException extends AppException {
  const NetworkTimeoutException(super.message, {super.cause, super.code});
}

/// HTTP 401.
final class UnauthorizedException extends AppException {
  const UnauthorizedException(super.message, {super.cause, super.code});
}

/// HTTP 403.
final class ForbiddenException extends AppException {
  const ForbiddenException(super.message, {super.cause, super.code});
}

/// HTTP 404.
final class NotFoundException extends AppException {
  const NotFoundException(super.message, {super.cause, super.code});
}

/// HTTP 5xx.
final class ServerException extends AppException {
  const ServerException(
    super.message, {
    this.statusCode,
    super.cause,
    super.code,
  });

  final int? statusCode;
}

/// Any other non-success HTTP status (e.g. 400, 409, 422, 429).
final class ApiException extends AppException {
  const ApiException(
    super.message, {
    required this.statusCode,
    this.retryAfterSeconds,
    super.cause,
    super.code,
  });

  final int statusCode;

  /// From the `Retry-After` header, when the server asked the client to wait.
  final int? retryAfterSeconds;
}

/// Local secure storage failed to read or write.
final class StorageException extends AppException {
  const StorageException(super.message, {super.cause, super.code});
}

/// The request was cancelled by the caller.
final class RequestCancelledException extends AppException {
  const RequestCancelledException(super.message, {super.cause, super.code});
}

/// Anything that does not fit the categories above.
final class UnknownException extends AppException {
  const UnknownException(super.message, {super.cause, super.code});
}
