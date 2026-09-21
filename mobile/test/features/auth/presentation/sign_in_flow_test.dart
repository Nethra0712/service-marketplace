import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/domain/otp_challenge.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/pump_app.dart';

void main() {
  late AuthHarness h;
  final en = lookupAppLocalizations(const Locale('en'));

  setUp(() => h = AuthHarness());
  tearDown(() => h.dispose());

  final sendButton = find.byKey(const Key('send_code_button'));
  final verifyButton = find.byKey(const Key('verify_button'));
  final resendButton = find.byKey(const Key('resend_button'));
  final changeNumberButton = find.byKey(const Key('change_number_button'));

  Future<void> enterPhoneAndSend(
    WidgetTester tester, [
    String phone = '077 123 4567',
  ]) async {
    await tester.enterText(phoneField, phone);
    await tester.tap(sendButton);
    await settle(tester);
  }

  testWidgets('the complete flow: phone, code, home', (tester) async {
    await pumpApp(tester, h);
    expect(phoneField, findsOneWidget);

    await enterPhoneAndSend(tester);

    // Second screen: shows where the code was sent, in a readable format.
    expect(h.auth.requestedPhones, ['+94771234567']);
    expect(find.text('Verify your number'), findsOneWidget);
    expect(
      find.text('Enter the code we sent to +94 77 123 4567.'),
      findsOneWidget,
    );
    expect(codeField, findsOneWidget);

    await tester.enterText(codeField, '123456');
    await tester.tap(verifyButton);
    await settle(tester);

    expect(h.auth.verifyCalls.single, (
      challengeId: 'challenge-1',
      code: '123456',
    ));
    expect(homeWelcome, findsOneWidget);
    expect(find.text('Signed in as +94 77 123 4567'), findsOneWidget);
    expect(h.storage.values, isNotEmpty); // Session persisted securely.
    expect(codeField, findsNothing);
  });

  testWidgets(
    'an invalid phone number shows a localized error and sends nothing',
    (tester) async {
      await pumpApp(tester, h);

      await enterPhoneAndSend(tester, '12345');

      expect(find.text(en.errorInvalidPhone), findsOneWidget);
      expect(h.auth.requestedPhones, isEmpty);
      expect(phoneField, findsOneWidget);
    },
  );

  testWidgets('the error disappears as soon as the person edits the number', (
    tester,
  ) async {
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester, '12345');
    expect(find.text(en.errorInvalidPhone), findsOneWidget);

    await tester.enterText(phoneField, '0771234567');
    await settle(tester);

    expect(find.text(en.errorInvalidPhone), findsNothing);
  });

  for (final input in ['0771234567', '+94 77 123 4567', '771234567']) {
    testWidgets('accepts the number written as "$input"', (tester) async {
      await pumpApp(tester, h);

      await enterPhoneAndSend(tester, input);

      expect(h.auth.requestedPhones, ['+94771234567']);
      expect(codeField, findsOneWidget);
    });
  }

  testWidgets(
    'a network failure while requesting the code stays on the phone screen',
    (tester) async {
      h.auth.onRequestOtp = (_) => throw const NetworkException('offline');
      await pumpApp(tester, h);

      await enterPhoneAndSend(tester);

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(phoneField, findsOneWidget);
      expect(codeField, findsNothing);
    },
  );

  testWidgets(
    'disables the button and shows progress while the code is being requested',
    (tester) async {
      final gate = Completer<OtpChallenge>();
      h.auth.onRequestOtp = (_) => gate.future;
      await pumpApp(tester, h);

      await tester.enterText(phoneField, '0771234567');
      await tester.tap(sendButton);
      await tester.pump();

      expect(tester.widget<FilledButton>(sendButton).onPressed, isNull);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      gate.complete(
        const OtpChallenge(
          challengeId: 'c',
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        ),
      );
      await settle(tester);
      expect(codeField, findsOneWidget);
    },
  );

  testWidgets('a wrong code shows an error and lets the person try again', (
    tester,
  ) async {
    h.auth.onVerifyOtp = (_, code) => code == '999999'
        ? Future.value(makeSession(h.clock.now, tag: 'ok'))
        : throw const UnauthorizedException('no', code: 'INVALID_OTP');
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester);

    await tester.enterText(codeField, '111111');
    await tester.tap(verifyButton);
    await settle(tester);

    expect(find.text(en.errorInvalidCode), findsOneWidget);
    expect(codeField, findsOneWidget);
    expect(homeWelcome, findsNothing);

    await tester.enterText(codeField, '999999');
    await tester.tap(verifyButton);
    await settle(tester);

    expect(homeWelcome, findsOneWidget);
  });

  testWidgets(
    'after too many wrong attempts the person is told to request a new code',
    (tester) async {
      h.auth.onVerifyOtp = (_, _) => throw const ApiException(
        'locked',
        statusCode: 429,
        code: 'OTP_ATTEMPTS_EXCEEDED',
      );
      await pumpApp(tester, h);
      await enterPhoneAndSend(tester);

      await tester.enterText(codeField, '000000');
      await tester.tap(verifyButton);
      await settle(tester);

      expect(find.text(en.errorAttemptsExceeded), findsOneWidget);
    },
  );

  testWidgets('the code field only accepts digits', (tester) async {
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester);

    await tester.enterText(codeField, '12ab-34');

    expect(tester.widget<TextField>(codeField).controller?.text, '1234');
  });

  testWidgets(
    'resend is disabled with a countdown, then enabled after the cooldown',
    (tester) async {
      await pumpApp(tester, h);
      await enterPhoneAndSend(tester);

      expect(tester.widget<TextButton>(resendButton).onPressed, isNull);
      expect(find.text('Resend code in 60s'), findsOneWidget);

      h.clock.advance(const Duration(seconds: 45));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend code in 15s'), findsOneWidget);

      h.clock.advance(const Duration(seconds: 20));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend code'), findsOneWidget);
      expect(tester.widget<TextButton>(resendButton).onPressed, isNotNull);
    },
  );

  testWidgets('resending issues a new code and clears the field', (
    tester,
  ) async {
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester);
    await tester.enterText(codeField, '1234');
    h.clock.advance(const Duration(seconds: 61));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(resendButton);
    await settle(tester);

    expect(h.auth.requestedPhones, ['+94771234567', '+94771234567']);
    expect(tester.widget<TextField>(codeField).controller?.text, isEmpty);
    // Verifying now uses the new challenge.
    await tester.enterText(codeField, '123456');
    await tester.tap(verifyButton);
    await settle(tester);
    expect(h.auth.verifyCalls.single.challengeId, 'challenge-2');
  });

  testWidgets('"use a different number" goes back to a clean phone screen', (
    tester,
  ) async {
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester);

    await tester.tap(changeNumberButton);
    await settle(tester);

    expect(phoneField, findsOneWidget);
    expect(codeField, findsNothing);
    // Requesting again starts a fresh flow.
    await enterPhoneAndSend(tester, '0712345678');
    expect(h.auth.requestedPhones.last, '+94712345678');
  });

  testWidgets('the system back button also discards the pending code', (
    tester,
  ) async {
    await pumpApp(tester, h);
    await enterPhoneAndSend(tester);

    await tester.pageBack();
    await settle(tester);

    expect(phoneField, findsOneWidget);
    expect(find.text(en.errorCooldown), findsNothing);
  });

  testWidgets('error messages follow the chosen language', (tester) async {
    await pumpApp(tester, h);

    await tester.tap(find.byIcon(Icons.language));
    await settle(tester);
    await tester.tap(find.text('සිංහල'));
    await settle(tester);
    await enterPhoneAndSend(tester, '12345');

    final si = lookupAppLocalizations(const Locale('si'));
    expect(find.text(si.errorInvalidPhone), findsOneWidget);
    expect(si.errorInvalidPhone, isNot(en.errorInvalidPhone));
  });
}
