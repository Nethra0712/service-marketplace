import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/features/auth/data/session_store.dart';

import '../helpers/fakes.dart';
import '../helpers/pump_app.dart';

void main() {
  late AuthHarness h;

  setUp(() => h = AuthHarness());
  tearDown(() => h.dispose());

  testWidgets('starts on the sign-in screen, in English, when signed out', (
    tester,
  ) async {
    await pumpApp(tester, h);

    expect(find.text('Sign in'), findsOneWidget); // App bar title.
    expect(find.text('Send code'), findsOneWidget);
    expect(phoneField, findsOneWidget);
  });

  testWidgets('navigates to each placeholder route once signed in', (
    tester,
  ) async {
    await SessionStore(h.storage).write(makeSession(h.clock.now));
    await pumpApp(tester, h);
    expect(homeWelcome, findsOneWidget);

    for (final label in ['Services', 'Profile']) {
      await tester.tap(find.text(label));
      await settle(tester);

      expect(find.widgetWithText(AppBar, label), findsOneWidget, reason: label);

      await tester.pageBack();
      await settle(tester);
      expect(homeWelcome, findsOneWidget);
    }
  });

  testWidgets(
    'switches language to Sinhala and Tamil, on the sign-in screen and after',
    (tester) async {
      await pumpApp(tester, h);

      for (final (nativeName, locale) in [
        ('සිංහල', const Locale('si')),
        ('தமிழ்', const Locale('ta')),
      ]) {
        await tester.tap(find.byIcon(Icons.language));
        await settle(tester);
        await tester.tap(find.text(nativeName));
        await settle(tester);

        final l10n = lookupAppLocalizations(locale);
        expect(
          find.text(l10n.authSendCode),
          findsOneWidget,
          reason: nativeName,
        );
        expect(
          find.text(l10n.authPhoneIntro),
          findsOneWidget,
          reason: nativeName,
        );
        expect(l10n.authSendCode, isNot('Send code'));
      }
    },
  );

  testWidgets('the signed-in home screen is localized too', (tester) async {
    await SessionStore(h.storage).write(makeSession(h.clock.now));
    await pumpApp(tester, h);

    await tester.tap(find.byIcon(Icons.language));
    await settle(tester);
    await tester.tap(find.text('தமிழ்'));
    await settle(tester);

    final ta = lookupAppLocalizations(const Locale('ta'));
    expect(find.text(ta.homeWelcome), findsOneWidget);
    expect(find.text(ta.authSignOut), findsOneWidget);
  });
}
