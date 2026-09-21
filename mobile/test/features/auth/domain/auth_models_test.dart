import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/domain/auth_session.dart';
import 'package:mobile/features/auth/domain/current_user.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';

void main() {
  final now = DateTime.utc(2026, 1, 1, 12);

  // Shapes copied from the real backend's responses.
  final tokenResponse = <String, dynamic>{
    'tokenType': 'Bearer',
    'accessToken': 'aaa.bbb.ccc',
    'accessTokenExpiresInSeconds': 900,
    'refreshToken': 'refresh-token-value',
    'refreshTokenExpiresInSeconds': 2592000,
  };

  group('AuthSession', () {
    test(
      'turns the server’s relative lifetimes into absolute expiry times',
      () {
        final session = AuthSession.fromTokenResponse(tokenResponse, now);

        expect(session.accessToken, 'aaa.bbb.ccc');
        expect(session.refreshToken, 'refresh-token-value');
        expect(
          session.accessTokenExpiresAt,
          now.add(const Duration(minutes: 15)),
        );
        expect(
          session.refreshTokenExpiresAt,
          now.add(const Duration(days: 30)),
        );
      },
    );

    test('rejects an unexpected response instead of storing garbage', () {
      for (final broken in <Map<String, dynamic>>[
        {},
        {...tokenResponse, 'accessToken': 123},
        {...tokenResponse, 'accessTokenExpiresInSeconds': '900'},
        {...tokenResponse, 'refreshToken': null},
        {...tokenResponse}..remove('refreshTokenExpiresInSeconds'),
      ]) {
        expect(
          () => AuthSession.fromTokenResponse(broken, now),
          throwsA(isA<UnknownException>()),
          reason: '$broken',
        );
      }
    });

    test('survives a JSON round trip exactly', () {
      final original = AuthSession.fromTokenResponse(tokenResponse, now);

      final restored = AuthSession.fromJson(original.toJson());

      expect(restored.accessToken, original.accessToken);
      expect(restored.refreshToken, original.refreshToken);
      expect(restored.accessTokenExpiresAt, original.accessTokenExpiresAt);
      expect(restored.refreshTokenExpiresAt, original.refreshTokenExpiresAt);
    });

    test(
      'knows when the access token needs renewing, with a safety margin',
      () {
        final session = AuthSession.fromTokenResponse(tokenResponse, now);

        expect(session.isAccessTokenExpiring(now), isFalse);
        expect(
          session.isAccessTokenExpiring(now.add(const Duration(minutes: 14))),
          isFalse,
        );
        // Inside the 30-second margin, and past expiry.
        expect(
          session.isAccessTokenExpiring(
            now.add(const Duration(minutes: 14, seconds: 31)),
          ),
          isTrue,
        );
        expect(
          session.isAccessTokenExpiring(now.add(const Duration(minutes: 16))),
          isTrue,
        );
      },
    );

    test('knows when the refresh token has expired', () {
      final session = AuthSession.fromTokenResponse(tokenResponse, now);

      expect(session.isRefreshTokenExpired(now), isFalse);
      expect(
        session.isRefreshTokenExpired(now.add(const Duration(days: 29))),
        isFalse,
      );
      expect(
        session.isRefreshTokenExpired(now.add(const Duration(days: 30))),
        isTrue,
      );
    });

    test('never reveals its tokens when printed or logged', () {
      final session = AuthSession.fromTokenResponse(tokenResponse, now);

      expect('$session', isNot(contains('aaa.bbb.ccc')));
      expect('$session', isNot(contains('refresh-token-value')));
    });
  });

  group('CurrentUser', () {
    test('parses the /me response', () {
      final user = CurrentUser.fromJson({
        'id': 'u-1',
        'phone': '+94771234567',
        'status': 'active',
        'roles': ['customer', 'provider'],
        'profile': {'fullName': 'Nimal Perera', 'preferredLanguage': 'si'},
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(user.id, 'u-1');
      expect(user.phone, '+94771234567');
      expect(user.roles, ['customer', 'provider']);
      expect(user.fullName, 'Nimal Perera');
    });

    test('handles an account with no profile yet', () {
      final user = CurrentUser.fromJson({
        'id': 'u-1',
        'phone': '+94771234567',
        'status': 'active',
        'roles': ['customer'],
        'profile': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(user.fullName, isNull);
    });

    test('rejects a malformed response', () {
      expect(
        () => CurrentUser.fromJson({'id': 1}),
        throwsA(isA<UnknownException>()),
      );
    });
  });

  group('OtpChallenge', () {
    test('parses the request-code response', () {
      final challenge = OtpChallenge.fromJson({
        'challengeId': '5b4e7c1e-0000-4000-8000-000000000000',
        'expiresInSeconds': 300,
        'resendAfterSeconds': 60,
      });

      expect(challenge.challengeId, '5b4e7c1e-0000-4000-8000-000000000000');
      expect(challenge.expiresInSeconds, 300);
      expect(challenge.resendAfterSeconds, 60);
    });

    test('rejects a malformed response', () {
      expect(
        () => OtpChallenge.fromJson({'challengeId': 'x'}),
        throwsA(isA<UnknownException>()),
      );
    });
  });
}
