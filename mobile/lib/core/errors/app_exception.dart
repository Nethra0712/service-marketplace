/// Errors surfaced by the data layer.
///
/// Repositories throw these instead of leaking `DioException` or platform
/// exceptions, so state and UI code never depend on a networking library.
sealed class AppException implements Exception {
  const AppException(this.message, {this.cause});

  /// Developer-facing description. Never shown to users directly: the UI maps
  /// the exception type to a localized message.
  final String message;

  /// The underlying error, kept for logging.
  final Object? cause;

  @override
  String toString() => '$runtimeType: $message';
}

/// The device could not reach the server (offline, DNS, TLS, refused).
final class NetworkException extends AppException {
  const NetworkException(super.message, {super.cause});
}

/// The request exceeded a connect/send/receive timeout.
final class NetworkTimeoutException extends AppException {
  const NetworkTimeoutException(super.message, {super.cause});
}

/// HTTP 401.
final class UnauthorizedException extends AppException {
  const UnauthorizedException(super.message, {super.cause});
}

/// HTTP 403.
final class ForbiddenException extends AppException {
  const ForbiddenException(super.message, {super.cause});
}

/// HTTP 404.
final class NotFoundException extends AppException {
  const NotFoundException(super.message, {super.cause});
}

/// HTTP 5xx.
final class ServerException extends AppException {
  const ServerException(super.message, {this.statusCode, super.cause});

  final int? statusCode;
}

/// Any other non-success HTTP status (e.g. 400, 409, 422).
final class ApiException extends AppException {
  const ApiException(super.message, {required this.statusCode, super.cause});

  final int statusCode;
}

/// Local secure storage failed to read or write.
final class StorageException extends AppException {
  const StorageException(super.message, {super.cause});
}

/// The request was cancelled by the caller.
final class RequestCancelledException extends AppException {
  const RequestCancelledException(super.message, {super.cause});
}

/// Anything that does not fit the categories above.
final class UnknownException extends AppException {
  const UnknownException(super.message, {super.cause});
}
