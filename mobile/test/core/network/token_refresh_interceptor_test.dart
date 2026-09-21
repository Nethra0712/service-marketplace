import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';

import '../../helpers/fake_http.dart';

const _config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

/// A client whose server accepts only `Bearer <goodToken>`.
class _Rig {
  _Rig({this.refreshSucceeds = true, this.serverAccepts = 'new-token'}) {
    adapter = FakeAdapter((options) async {
      final auth = options.headers['Authorization'];
      return auth == 'Bearer $serverAccepts'
          ? jsonBody({'ok': true})
          : errorBody(401, 'UNAUTHENTICATED');
    });
    final dio = createDio(
      config: _config,
      readAccessToken: () async => token,
      refreshTokens: () async {
        refreshCalls += 1;
        // A successful refresh hands out "new-token"; whether the server
        // accepts it is controlled separately by [serverAccepts].
        if (refreshSucceeds) token = 'new-token';
        return refreshSucceeds;
      },
    )..httpClientAdapter = adapter;
    client = ApiClient(dio);
  }

  final bool refreshSucceeds;

  /// The only bearer token the fake server treats as valid.
  final String serverAccepts;
  String? token = 'old-token';
  int refreshCalls = 0;
  late final FakeAdapter adapter;
  late final ApiClient client;
}

void main() {
  test(
    'renews the token after a 401 and replays the request with it',
    () async {
      final rig = _Rig();

      final data = await rig.client.get('/api/auth/me');

      expect(data, {'ok': true});
      expect(rig.refreshCalls, 1);
      expect(rig.adapter.requests, hasLength(2));
      // What each request carried when it was actually sent.
      expect(rig.adapter.authorizations, [
        'Bearer old-token',
        'Bearer new-token',
      ]);
    },
  );

  test('surfaces the 401 when the token cannot be renewed', () async {
    final rig = _Rig(refreshSucceeds: false);

    await expectLater(
      rig.client.get('/api/auth/me'),
      throwsA(isA<UnauthorizedException>()),
    );

    expect(rig.refreshCalls, 1);
    expect(rig.adapter.requests, hasLength(1)); // No pointless retry.
  });

  test('replays at most once, so a dead session cannot loop', () async {
    // The server rejects even the new token.
    final rig = _Rig(serverAccepts: 'a-token-nobody-has');

    await expectLater(
      rig.client.get('/api/auth/me'),
      throwsA(isA<UnauthorizedException>()),
    );

    expect(rig.refreshCalls, 1);
    expect(rig.adapter.requests, hasLength(2));
  });

  test('does not try to renew for errors other than 401', () async {
    final rig = _Rig();
    final adapter = FakeAdapter(
      (_) async => errorBody(403, 'ACCOUNT_SUSPENDED'),
    );
    final dio = createDio(
      config: _config,
      readAccessToken: () async => 'x',
      refreshTokens: () async {
        rig.refreshCalls += 1;
        return true;
      },
    )..httpClientAdapter = adapter;

    await expectLater(
      ApiClient(dio).get('/x'),
      throwsA(isA<ForbiddenException>()),
    );
    expect(rig.refreshCalls, 0);
  });

  test('leaves successful requests alone', () async {
    final rig = _Rig()..token = 'new-token';

    await rig.client.get('/api/auth/me');

    expect(rig.refreshCalls, 0);
    expect(rig.adapter.requests, hasLength(1));
  });

  test(
    'a client with no refresher (the unauthenticated one) never retries',
    () async {
      var calls = 0;
      final adapter = FakeAdapter((_) async {
        calls += 1;
        return errorBody(401, 'INVALID_OTP');
      });
      final dio = createDio(config: _config, readAccessToken: () async => null)
        ..httpClientAdapter = adapter;

      await expectLater(
        ApiClient(dio).post('/api/auth/otp/verify', data: {}),
        throwsA(isA<UnauthorizedException>()),
      );
      expect(calls, 1);
      expect(
        adapter.lastRequest?.headers.containsKey('Authorization'),
        isFalse,
      );
    },
  );
}
