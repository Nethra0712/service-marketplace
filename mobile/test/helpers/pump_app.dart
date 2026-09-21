import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/app/router/app_router.dart';

import 'fakes.dart';

/// The real app (real router, real screens) on top of the fake I/O in [h].
Widget appFor(AuthHarness h) => UncontrolledProviderScope(
  container: h.container,
  child: const ServiceMarketplaceApp(),
);

/// Pumps [appFor] and lets startup (session restoration) finish.
Future<void> pumpApp(WidgetTester tester, AuthHarness h) async {
  await tester.pumpWidget(appFor(h));
  await settle(tester);
}

/// Lets animations and pending async work finish.
///
/// `pumpAndSettle` cannot be used on the code screen: its resend countdown
/// re-renders every second, so the tree never becomes idle. Pumping a fixed
/// amount of time works everywhere.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i += 1) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

GoRouter routerOf(AuthHarness h) => h.container.read(routerProvider);

/// Text shown by the home screen, used to recognise it.
final homeWelcome = find.text('Welcome to Service Marketplace');
final phoneField = find.byKey(const Key('phone_field'));
final codeField = find.byKey(const Key('code_field'));
