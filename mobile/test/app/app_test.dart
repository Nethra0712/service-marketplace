import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';

Future<void> pumpApp(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(
          const AppConfig(
            environment: AppEnvironment.dev,
            apiBaseUrl: 'http://localhost:3000',
            enableNetworkLogging: false,
          ),
        ),
      ],
      child: const ServiceMarketplaceApp(),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('starts on the home screen in English', (tester) async {
    await pumpApp(tester);

    expect(find.text('Welcome to Service Marketplace'), findsOneWidget);
  });

  testWidgets('navigates to each placeholder route', (tester) async {
    await pumpApp(tester);

    for (final label in ['Services', 'Profile', 'Sign in']) {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();

      expect(
        find.text('This screen is a placeholder.'),
        findsOneWidget,
        reason: label,
      );
      expect(find.widgetWithText(AppBar, label), findsOneWidget, reason: label);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('Welcome to Service Marketplace'), findsOneWidget);
    }
  });

  testWidgets('switches language to Sinhala and Tamil', (tester) async {
    await pumpApp(tester);

    for (final (nativeName, locale) in [
      ('සිංහල', const Locale('si')),
      ('தமிழ்', const Locale('ta')),
    ]) {
      await tester.tap(find.byIcon(Icons.language));
      await tester.pumpAndSettle();
      await tester.tap(find.text(nativeName));
      await tester.pumpAndSettle();

      final expected = lookupAppLocalizations(locale).homeWelcome;
      expect(find.text(expected), findsOneWidget, reason: nativeName);
      expect(expected, isNot('Welcome to Service Marketplace'));
    }
  });
}
