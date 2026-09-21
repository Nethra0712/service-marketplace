import 'package:dio/dio.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/constants/app_constants.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/network/logging_interceptor.dart';
import 'package:mobile/core/network/token_refresh_interceptor.dart';

/// Builds a [Dio] instance for the platform API.
///
/// Pass [refreshTokens] for the authenticated client: a 401 then triggers one
/// refresh-and-retry. The unauthenticated client (sign-in, refresh, sign-out
/// calls) passes neither a token reader nor a refresher, so it can never
/// recurse into a refresh loop or leak a token.
Dio createDio({
  required AppConfig config,
  required AccessTokenReader readAccessToken,
  TokenRefresher? refreshTokens,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: NetworkDefaults.connectTimeout,
      sendTimeout: NetworkDefaults.sendTimeout,
      receiveTimeout: NetworkDefaults.receiveTimeout,
      responseType: ResponseType.json,
      headers: const {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(AccessTokenInterceptor(readAccessToken));
  if (refreshTokens != null) {
    dio.interceptors.add(
      TokenRefreshInterceptor(
        dio: dio,
        refresh: refreshTokens,
        readAccessToken: readAccessToken,
      ),
    );
  }
  if (config.enableNetworkLogging) {
    dio.interceptors.add(LoggingInterceptor());
  }
  return dio;
}
