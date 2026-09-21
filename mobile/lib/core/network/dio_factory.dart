import 'package:dio/dio.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/constants/app_constants.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/network/logging_interceptor.dart';

/// Builds the single [Dio] instance used for the platform API.
Dio createDio({
  required AppConfig config,
  required AccessTokenReader readAccessToken,
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
  if (config.enableNetworkLogging) {
    dio.interceptors.add(LoggingInterceptor());
  }
  return dio;
}
