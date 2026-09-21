import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';

import '../../helpers/fake_http.dart';

const config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

(ApiClient, FakeAdapter) build(
  Future<ResponseBody> Function(RequestOptions) handler, {
  Future<String?> Function()? token,
}) {
  final adapter = FakeAdapter(handler);
  final dio = createDio(
    config: config,
    readAccessToken: token ?? () async => null,
  )..httpClientAdapter = adapter;
  return (ApiClient(dio), adapter);
}

void main() {
  test(
    'returns decoded JSON and resolves against the configured base URL',
    () async {
      final (client, adapter) = build((_) async => jsonBody({'ok': true}));

      final data = await client.get('/health');

      expect(data, {'ok': true});
      expect(
        adapter.lastRequest!.uri.toString(),
        'http://localhost:3000/health',
      );
    },
  );

  test('sends no Authorization header without a token', () async {
    final (client, adapter) = build((_) async => jsonBody({}));
    await client.get('/x');
    expect(adapter.lastRequest!.headers.containsKey('Authorization'), isFalse);
  });

  test('attaches a bearer token when one is available', () async {
    final (client, adapter) = build(
      (_) async => jsonBody({}),
      token: () async => 'test-token',
    );
    await client.get('/x');
    expect(adapter.lastRequest!.headers['Authorization'], 'Bearer test-token');
  });

  test('maps HTTP status codes to AppExceptions', () async {
    final cases = <int, Matcher>{
      401: isA<UnauthorizedException>(),
      403: isA<ForbiddenException>(),
      404: isA<NotFoundException>(),
      422: isA<ApiException>().having((e) => e.statusCode, 'statusCode', 422),
      503: isA<ServerException>().having(
        (e) => e.statusCode,
        'statusCode',
        503,
      ),
    };
    for (final entry in cases.entries) {
      final (client, _) = build((_) async => jsonBody({}, status: entry.key));
      await expectLater(
        client.get('/x'),
        throwsA(entry.value),
        reason: '${entry.key}',
      );
    }
  });

  test('maps timeouts and connection failures', () async {
    final (timeoutClient, _) = build(
      (o) async => throw DioException(
        requestOptions: o,
        type: DioExceptionType.receiveTimeout,
      ),
    );
    await expectLater(
      timeoutClient.get('/x'),
      throwsA(isA<NetworkTimeoutException>()),
    );

    final (offlineClient, _) = build(
      (o) async => throw DioException(
        requestOptions: o,
        type: DioExceptionType.connectionError,
      ),
    );
    await expectLater(
      offlineClient.get('/x'),
      throwsA(isA<NetworkException>()),
    );
  });
}
