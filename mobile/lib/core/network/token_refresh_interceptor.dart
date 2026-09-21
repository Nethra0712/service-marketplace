import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';

/// Tries to obtain a fresh access token. Returns true if it succeeded.
typedef TokenRefresher = Future<bool> Function();

/// Extension point for authentication, next to `accessTokenReaderProvider`.
/// The auth feature overrides it; until then nothing is ever refreshed.
final tokenRefresherProvider = Provider<TokenRefresher>(
  (ref) =>
      () async => false,
);

/// When the API answers 401, asks for a new access token and replays the
/// request once with it.
///
/// Every request is replayed at most once (`retried` flag), so a session that
/// is genuinely dead surfaces the 401 to the caller instead of looping.
class TokenRefreshInterceptor extends Interceptor {
  TokenRefreshInterceptor({
    required this._dio,
    required this._refresh,
    required this._readAccessToken,
  });

  static const _retriedKey = 'token_refresh_retried';

  final Dio _dio;
  final TokenRefresher _refresh;
  final AccessTokenReader _readAccessToken;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final alreadyRetried = options.extra[_retriedKey] == true;

    if (err.response?.statusCode != 401 || alreadyRetried) {
      handler.next(err);
      return;
    }

    final refreshed = await _refresh();
    final token = refreshed ? await _readAccessToken() : null;
    if (token == null || token.isEmpty) {
      handler.next(err);
      return;
    }

    options.extra[_retriedKey] = true;
    options.headers['Authorization'] = 'Bearer $token';
    try {
      handler.resolve(await _dio.fetch<dynamic>(options));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }
}
