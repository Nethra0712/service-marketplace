import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/network/access_token_interceptor.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = createDio(
    config: ref.watch(appConfigProvider),
    readAccessToken: ref.watch(accessTokenReaderProvider),
  );
  ref.onDispose(dio.close);
  return dio;
});

/// Entry point for feature repositories:
/// `ref.watch(apiClientProvider)`.
final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(dioProvider)),
);
