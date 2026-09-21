import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';
import 'package:mobile/core/network/token_refresh_interceptor.dart';

/// The authenticated client: attaches the access token and, on a 401, refreshes
/// it once and retries.
final dioProvider = Provider<Dio>((ref) {
  final dio = createDio(
    config: ref.watch(appConfigProvider),
    readAccessToken: ref.watch(accessTokenReaderProvider),
    refreshTokens: ref.watch(tokenRefresherProvider),
  );
  ref.onDispose(dio.close);
  return dio;
});

/// Entry point for feature repositories that need a signed-in user:
/// `ref.watch(apiClientProvider)`.
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(dioProvider)),
);

/// A client that never sends or refreshes credentials. Used only for the calls
/// that establish, renew or end a session (request/verify OTP, refresh, logout).
final publicDioProvider = Provider<Dio>((ref) {
  final dio = createDio(
    config: ref.watch(appConfigProvider),
    readAccessToken: () async => null,
  );
  ref.onDispose(dio.close);
  return dio;
});

final publicApiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(publicDioProvider)),
);
