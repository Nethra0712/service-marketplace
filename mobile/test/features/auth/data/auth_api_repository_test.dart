import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';
import 'package:mobile/features/auth/data/auth_api_repository.dart';
import 'package:mobile/features/auth/data/current_user_api_repository.dart';

import '../../../helpers/fake_http.dart';

const _config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

// Response bodies copied from the real backend.
const _challengeJson = {
  'challengeId': '5b4e7c1e-0000-4000-8000-000000000000',
  'expiresInSeconds': 300,
  'resendAfterSeconds': 60,
};
const _tokensJson = {
  'tokenType': 'Bearer',
  'accessToken': 'aaa.bbb.ccc',
  'accessTokenExpiresInSeconds': 900,
  'refreshToken': 'refresh-token-value',
  'refreshTokenExpiresInSeconds': 2592000,
};

(AuthApiRepository, FakeAdapter) _authRepo(
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final adapter = FakeAdapter(handler);
  final dio = createDio(config: _config, readAccessToken: () async => null)
    ..httpClientAdapter = adapter;
  final now = DateTime.utc(2026, 1, 1, 12);
  return (AuthApiRepository(ApiClient(dio), () => now), adapter);
}

void main() {
  final now = DateTime.utc(2026, 1, 1, 12);

  test('requests a code by POSTing the phone number', () async {
    final (repo, adapter) = _authRepo(
      (_) async => jsonBody(_challengeJson, status: 202),
    );

    final challenge = await repo.requestOtp('+94771234567');

    expect(adapter.lastRequest?.method, 'POST');
    expect(
      adapter.lastRequest?.uri.toString(),
      'http://localhost:3000/api/auth/otp/request',
    );
    expect(adapter.lastRequest?.data, {'phone': '+94771234567'});
    expect(challenge.challengeId, '5b4e7c1e-0000-4000-8000-000000000000');
    expect(challenge.resendAfterSeconds, 60);
  });

  test(
    'verifies a code and builds a session with absolute expiry times',
    () async {
      final (repo, adapter) = _authRepo((_) async => jsonBody(_tokensJson));

      final session = await repo.verifyOtp(challengeId: 'c-1', code: '123456');

      expect(adapter.lastRequest?.uri.path, '/api/auth/otp/verify');
      expect(adapter.lastRequest?.data, {
        'challengeId': 'c-1',
        'code': '123456',
      });
      expect(session.accessToken, 'aaa.bbb.ccc');
      expect(
        session.accessTokenExpiresAt,
        now.add(const Duration(minutes: 15)),
      );
      expect(session.refreshTokenExpiresAt, now.add(const Duration(days: 30)));
    },
  );

  test('refreshes with the refresh token in the body', () async {
    final (repo, adapter) = _authRepo((_) async => jsonBody(_tokensJson));

    await repo.refresh('old-refresh');

    expect(adapter.lastRequest?.uri.path, '/api/auth/refresh');
    expect(adapter.lastRequest?.data, {'refreshToken': 'old-refresh'});
  });

  test(
    'logs out with the refresh token and accepts the empty 204 response',
    () async {
      final (repo, adapter) = _authRepo(
        (_) async => ResponseBody.fromString('', 204),
      );

      await repo.logout('old-refresh');

      expect(adapter.lastRequest?.uri.path, '/api/auth/logout');
      expect(adapter.lastRequest?.data, {'refreshToken': 'old-refresh'});
    },
  );

  test('never sends an Authorization header on any of these calls', () async {
    final (repo, adapter) = _authRepo((_) async => jsonBody(_tokensJson));

    await repo.refresh('r');
    await repo.verifyOtp(challengeId: 'c', code: '123456');

    for (final request in adapter.requests) {
      expect(request.headers.containsKey('Authorization'), isFalse);
    }
  });

  group('error mapping from the backend’s error body', () {
    test('a wrong code becomes UnauthorizedException(INVALID_OTP)', () async {
      final (repo, _) = _authRepo((_) async => errorBody(401, 'INVALID_OTP'));

      await expectLater(
        repo.verifyOtp(challengeId: 'c', code: '000000'),
        throwsA(
          isA<UnauthorizedException>().having(
            (e) => e.code,
            'code',
            'INVALID_OTP',
          ),
        ),
      );
    });

    test('the resend cooldown carries its code and Retry-After', () async {
      final (repo, _) = _authRepo(
        (_) async => errorBody(
          429,
          'OTP_RESEND_COOLDOWN',
          headers: {
            'retry-after': ['42'],
          },
        ),
      );

      await expectLater(
        repo.requestOtp('+94771234567'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 429)
              .having((e) => e.code, 'code', 'OTP_RESEND_COOLDOWN')
              .having((e) => e.retryAfterSeconds, 'retryAfterSeconds', 42),
        ),
      );
    });

    test('a suspended account becomes ForbiddenException', () async {
      final (repo, _) = _authRepo(
        (_) async => errorBody(403, 'ACCOUNT_SUSPENDED'),
      );

      await expectLater(
        repo.verifyOtp(challengeId: 'c', code: '123456'),
        throwsA(
          isA<ForbiddenException>().having(
            (e) => e.code,
            'code',
            'ACCOUNT_SUSPENDED',
          ),
        ),
      );
    });

    test('an SMS outage becomes ServerException(SMS_UNAVAILABLE)', () async {
      final (repo, _) = _authRepo(
        (_) async => errorBody(503, 'SMS_UNAVAILABLE'),
      );

      await expectLater(
        repo.requestOtp('+94771234567'),
        throwsA(
          isA<ServerException>().having(
            (e) => e.code,
            'code',
            'SMS_UNAVAILABLE',
          ),
        ),
      );
    });

    test(
      'an error body of an unexpected shape still maps by status, with no code',
      () async {
        final (repo, _) = _authRepo(
          (_) async => jsonBody('<html>proxy error</html>', status: 502),
        );

        await expectLater(
          repo.requestOtp('+94771234567'),
          throwsA(isA<ServerException>().having((e) => e.code, 'code', isNull)),
        );
      },
    );

    test('a success response of the wrong shape is an UnknownException, not a crash', () async {
      final (repo, _) = _authRepo(
        (_) async => jsonBody(['not', 'an', 'object']),
      );

      await expectLater(
        repo.requestOtp('+94771234567'),
        throwsA(isA<UnknownException>()),
      );
    });
  });

  group('CurrentUserApiRepository', () {
    test('reads /me through the authenticated client', () async {
      final adapter = FakeAdapter(
        (_) async => jsonBody({
          'id': 'u-1',
          'phone': '+94771234567',
          'status': 'active',
          'roles': ['customer'],
          'profile': null,
          'createdAt': '2026-01-01T00:00:00.000Z',
        }),
      );
      final dio = createDio(
        config: _config,
        readAccessToken: () async => 'my-access-token',
      )..httpClientAdapter = adapter;

      final user = await CurrentUserApiRepository(ApiClient(dio))
          .fetchCurrentUser();

      expect(adapter.lastRequest?.uri.path, '/api/auth/me');
      expect(
        adapter.lastRequest?.headers['Authorization'],
        'Bearer my-access-token',
      );
      expect(user.phone, '+94771234567');
      expect(user.roles, ['customer']);
    });
  });
}
