import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Supplies the current access token, or null when signed out.
typedef AccessTokenReader = Future<String?> Function();

/// Extension point for authentication. The auth feature will override this
/// provider once it exists; until then no token is ever attached.
final accessTokenReaderProvider = Provider<AccessTokenReader>(
  (ref) =>
      () async => null,
);

/// Attaches `Authorization: Bearer <token>` when a token is available.
///
/// Only registered on the Dio instance whose base URL is our own API, so the
/// token is never sent to third-party hosts.
class AccessTokenInterceptor extends Interceptor {
  AccessTokenInterceptor(this._readToken);

  final AccessTokenReader _readToken;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _readToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}
