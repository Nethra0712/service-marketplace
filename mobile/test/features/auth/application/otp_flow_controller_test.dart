import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/auth/application/otp_flow_controller.dart';
import 'package:mobile/features/auth/application/otp_flow_state.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/auth_status.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';

import '../../../helpers/fakes.dart';

void main() {
  late AuthHarness h;
  late List<OtpFlowState> states;

  setUp(() async {
    h = AuthHarness();
    states = [];
    // The provider is auto-disposed: keep it alive, and record every state.
    h.container.listen(
      otpFlowControllerProvider,
      (_, next) => states.add(next),
      fireImmediately: true,
    );
    // Let the startup session check finish first, as it does in the real app.
    h.container.read(authControllerProvider);
    await h.container.read(authControllerProvider.notifier).ready;
  });

  tearDown(() => h.dispose());

  OtpFlowController flow() =>
      h.container.read(otpFlowControllerProvider.notifier);
  OtpFlowState state() => h.container.read(otpFlowControllerProvider);

  Future<void> requestCode() async {
    expect(await flow().submitPhone('077 123 4567'), isTrue);
  }

  group('entering the phone number', () {
    test('starts idle with nothing entered', () {
      expect(state().status, OtpFlowStatus.idle);
      expect(state().challenge, isNull);
      expect(state().error, isNull);
    });

    test(
      'rejects an invalid number locally, without contacting the server',
      () async {
        final sent = await flow().submitPhone('12345');

        expect(sent, isFalse);
        expect(state().error, OtpFlowError.invalidPhone);
        expect(state().status, OtpFlowStatus.idle);
        expect(h.auth.requestedPhones, isEmpty);
      },
    );

    test(
      'normalises what was typed and requests a code for that number',
      () async {
        await requestCode();

        expect(h.auth.requestedPhones, ['+94771234567']);
        expect(state().phoneE164, '+94771234567');
        expect(state().status, OtpFlowStatus.awaitingCode);
        expect(state().challenge?.challengeId, 'challenge-1');
        expect(state().error, isNull);
      },
    );

    test('passes through requesting-code while the server works', () async {
      final gate = Completer<OtpChallenge>();
      h.auth.onRequestOtp = (_) => gate.future;

      final pending = flow().submitPhone('0771234567');
      await pumpEventQueue();
      expect(state().status, OtpFlowStatus.requestingCode);
      expect(state().isBusy, isTrue);

      gate.complete(
        const OtpChallenge(
          challengeId: 'c',
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        ),
      );
      await pending;

      expect(state().status, OtpFlowStatus.awaitingCode);
      expect(
        states.map((s) => s.status),
        containsAllInOrder([
          OtpFlowStatus.idle,
          OtpFlowStatus.requestingCode,
          OtpFlowStatus.awaitingCode,
        ]),
      );
    });

    test(
      'starts the resend countdown from the server-provided cooldown',
      () async {
        await requestCode();

        expect(
          state().resendAvailableAt,
          h.clock.now.add(const Duration(seconds: 60)),
        );
        expect(state().secondsUntilResend(h.clock.now), 60);
        expect(state().canResend(h.clock.now), isFalse);
      },
    );

    test(
      'stays on the phone screen with an error if the request fails',
      () async {
        h.auth.onRequestOtp = (_) => throw const NetworkException('offline');

        final sent = await flow().submitPhone('0771234567');

        expect(sent, isFalse);
        expect(state().status, OtpFlowStatus.idle);
        expect(state().challenge, isNull);
        expect(state().error, OtpFlowError.network);
      },
    );

    test('lets the person correct a mistake and try again', () async {
      h.auth.onRequestOtp = (_) => throw const NetworkException('offline');
      await flow().submitPhone('0771234567');
      h.auth.onRequestOtp = null;

      expect(await flow().submitPhone('0771234567'), isTrue);
      expect(state().error, isNull);
    });
  });

  group('resending the code', () {
    test(
      'is blocked during the cooldown, without contacting the server',
      () async {
        await requestCode();
        h.clock.advance(const Duration(seconds: 30));

        final sent = await flow().resend();

        expect(sent, isFalse);
        expect(state().error, OtpFlowError.cooldown);
        expect(h.auth.requestedPhones, hasLength(1));
        expect(state().challenge?.challengeId, 'challenge-1');
      },
    );

    test('works after the cooldown and replaces the code', () async {
      await requestCode();
      h.clock.advance(const Duration(seconds: 61));
      expect(state().canResend(h.clock.now), isTrue);

      final sent = await flow().resend();

      expect(sent, isTrue);
      expect(h.auth.requestedPhones, ['+94771234567', '+94771234567']);
      expect(state().challenge?.challengeId, 'challenge-2');
      expect(state().error, isNull);
      expect(state().canResend(h.clock.now), isFalse); // A new cooldown began.
    });

    test('honours the wait the server asks for, and keeps the existing code screen', () async {
      await requestCode();
      h.clock.advance(const Duration(seconds: 61));
      h.auth.onRequestOtp = (_) => throw const ApiException(
        'wait',
        statusCode: 429,
        code: 'OTP_RESEND_COOLDOWN',
        retryAfterSeconds: 25,
      );

      final sent = await flow().resend();

      expect(sent, isFalse);
      expect(state().status, OtpFlowStatus.awaitingCode);
      expect(state().challenge?.challengeId, 'challenge-1');
      expect(state().error, OtpFlowError.cooldown);
      expect(state().secondsUntilResend(h.clock.now), 25);
    });

    test('does nothing before a number has been entered', () async {
      expect(await flow().resend(), isFalse);
      expect(h.auth.requestedPhones, isEmpty);
    });
  });

  group('verifying the code', () {
    test('does nothing when no code was requested', () async {
      expect(await flow().submitCode('123456'), isFalse);
      expect(h.auth.verifyCalls, isEmpty);
    });

    test('rejects a code that is obviously malformed, without contacting the server', () async {
      await requestCode();

      for (final bad in ['', '12', 'abcdef', '12 34', '123456789']) {
        expect(await flow().submitCode(bad), isFalse, reason: bad);
        expect(state().error, OtpFlowError.invalidCode, reason: bad);
      }
      expect(h.auth.verifyCalls, isEmpty);
      expect(h.container.read(authStatusProvider), AuthStatus.unauthenticated);
    });

    test('a correct code signs the user in and clears the flow', () async {
      await requestCode();

      final ok = await flow().submitCode('123456');

      expect(ok, isTrue);
      expect(h.auth.verifyCalls.single, (
        challengeId: 'challenge-1',
        code: '123456',
      ));
      expect(h.container.read(authStatusProvider), AuthStatus.authenticated);
      expect(
        (await SessionStore(h.storage).read())?.accessToken,
        'access-signin',
      );
      // The phone number and challenge are not kept around after signing in.
      expect(state().status, OtpFlowStatus.idle);
      expect(state().challenge, isNull);
      expect(state().phoneE164, isNull);
    });

    test('shows verifying while the server checks the code', () async {
      await requestCode();
      final gate = Completer<Never>();
      h.auth.onVerifyOtp = (_, _) => gate.future;

      final pending = flow().submitCode('123456');
      await pumpEventQueue();
      expect(state().status, OtpFlowStatus.verifying);
      expect(state().isBusy, isTrue);

      gate.completeError(
        const UnauthorizedException('no', code: 'INVALID_OTP'),
      );
      await pending;
      expect(state().status, OtpFlowStatus.awaitingCode);
    });

    test(
      'a wrong code keeps the person on the code screen with an error',
      () async {
        await requestCode();
        h.auth.onVerifyOtp = (_, _) =>
            throw const UnauthorizedException('no', code: 'INVALID_OTP');

        final ok = await flow().submitCode('000000');

        expect(ok, isFalse);
        expect(state().status, OtpFlowStatus.awaitingCode);
        expect(state().error, OtpFlowError.invalidCode);
        expect(state().challenge?.challengeId, 'challenge-1');
        expect(
          h.container.read(authStatusProvider),
          AuthStatus.unauthenticated,
        );
        expect(h.storage.values, isEmpty);
      },
    );

    test(
      'too many wrong attempts tells the person to request a new code',
      () async {
        await requestCode();
        h.auth.onVerifyOtp = (_, _) => throw const ApiException(
          'locked',
          statusCode: 429,
          code: 'OTP_ATTEMPTS_EXCEEDED',
        );

        await flow().submitCode('000000');

        expect(state().error, OtpFlowError.attemptsExceeded);
        expect(state().status, OtpFlowStatus.awaitingCode);
      },
    );

    test('an expired code is reported like a wrong one', () async {
      await requestCode();
      h.auth.onVerifyOtp = (_, _) =>
          throw const UnauthorizedException('expired', code: 'INVALID_OTP');

      await flow().submitCode('123456');

      expect(state().error, OtpFlowError.invalidCode);
    });

    test('typing again clears the error', () async {
      await requestCode();
      h.auth.onVerifyOtp = (_, _) =>
          throw const UnauthorizedException('no', code: 'INVALID_OTP');
      await flow().submitCode('000000');

      flow().clearError();

      expect(state().error, isNull);
      expect(state().challenge, isNotNull);
    });

    test('a suspended account is reported', () async {
      await requestCode();
      h.auth.onVerifyOtp = (_, _) =>
          throw const ForbiddenException('no', code: 'ACCOUNT_SUSPENDED');

      await flow().submitCode('123456');

      expect(state().error, OtpFlowError.accountSuspended);
      expect(h.container.read(authStatusProvider), AuthStatus.unauthenticated);
    });

    test('ignores a second submit while one is already in progress', () async {
      await requestCode();
      final gate = Completer<Never>();
      h.auth.onVerifyOtp = (_, _) => gate.future;

      final first = flow().submitCode('123456');
      await pumpEventQueue();
      final second = await flow().submitCode('123456');

      expect(second, isFalse);
      expect(h.auth.verifyCalls, hasLength(1));
      gate.completeError(
        const UnauthorizedException('no', code: 'INVALID_OTP'),
      );
      await first;
    });
  });

  group('changing the number', () {
    test('discards the pending code and returns to the start', () async {
      await requestCode();

      flow().changeNumber();

      expect(state().status, OtpFlowStatus.idle);
      expect(state().challenge, isNull);
      expect(state().phoneE164, isNull);
    });
  });

  group('mapOtpError', () {
    test('translates backend errors into what the person should be told', () {
      const cases = <(AppException, OtpFlowError)>[
        (NetworkException('x'), OtpFlowError.network),
        (NetworkTimeoutException('x'), OtpFlowError.network),
        (
          UnauthorizedException('x', code: 'INVALID_OTP'),
          OtpFlowError.invalidCode,
        ),
        (
          ApiException('x', statusCode: 429, code: 'OTP_ATTEMPTS_EXCEEDED'),
          OtpFlowError.attemptsExceeded,
        ),
        (
          ApiException('x', statusCode: 429, code: 'OTP_RESEND_COOLDOWN'),
          OtpFlowError.cooldown,
        ),
        (
          ApiException('x', statusCode: 429, code: 'RATE_LIMITED'),
          OtpFlowError.rateLimited,
        ),
        (
          ApiException('x', statusCode: 400, code: 'VALIDATION_ERROR'),
          OtpFlowError.invalidPhone,
        ),
        (
          ServerException('x', statusCode: 503, code: 'SMS_UNAVAILABLE'),
          OtpFlowError.smsUnavailable,
        ),
        (
          ForbiddenException('x', code: 'ACCOUNT_SUSPENDED'),
          OtpFlowError.accountSuspended,
        ),
        (ServerException('x', statusCode: 500), OtpFlowError.unknown),
        (UnknownException('x'), OtpFlowError.unknown),
        (ApiException('x', statusCode: 429), OtpFlowError.unknown),
      ];
      for (final (error, expected) in cases) {
        expect(mapOtpError(error), expected, reason: '$error ${error.code}');
      }
    });
  });
}
