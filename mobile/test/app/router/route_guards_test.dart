import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/data/session_store.dart';
import 'package:mobile/features/auth/domain/current_user.dart';

import '../../helpers/fakes.dart';
import '../../helpers/pump_app.dart';

void main() {
  late AuthHarness h;

  setUp(() => h = AuthHarness());
  tearDown(() => h.dispose());

  Future<void> storeSession() =>
      SessionStore(h.storage).write(makeSession(h.clock.now));

  testWidgets('a signed-out user lands on the sign-in screen', (tester) async {
    await pumpApp(tester, h);

    expect(phoneField, findsOneWidget);
    expect(homeWelcome, findsNothing);
  });

  testWidgets('a returning user with a stored session goes straight to home', (
    tester,
  ) async {
    await storeSession();

    await pumpApp(tester, h);

    expect(homeWelcome, findsOneWidget);
    expect(phoneField, findsNothing);
    expect(find.byKey(const Key('signed_in_as')), findsOneWidget);
    expect(find.text('Signed in as +94 77 123 4567'), findsOneWidget);
  });

  testWidgets(
    'shows a splash, not the sign-in screen, while the session is being checked',
    (tester) async {
      await storeSession();
      final gate = Completer<CurrentUser>();
      h.users.onFetch = () => gate.future;

      await tester.pumpWidget(appFor(h));
      await settle(tester);

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(phoneField, findsNothing);
      expect(homeWelcome, findsNothing);

      gate.complete(testUser);
      await settle(tester);

      expect(homeWelcome, findsOneWidget);
    },
  );

  testWidgets(
    'a stored session the server refuses ends up on the sign-in screen',
    (tester) async {
      await storeSession();
      h.users.onFetch = () => throw const UnauthorizedException('no');

      await pumpApp(tester, h);

      expect(phoneField, findsOneWidget);
      expect(h.storage.values, isEmpty);
    },
  );

  testWidgets(
    'a signed-out user cannot open protected screens by navigating to them',
    (tester) async {
      await pumpApp(tester, h);

      for (final path in ['/', '/services', '/profile']) {
        routerOf(h).go(path);
        await settle(tester);
        expect(phoneField, findsOneWidget, reason: path);
      }
    },
  );

  testWidgets('a signed-in user is turned away from the sign-in screens', (
    tester,
  ) async {
    await storeSession();
    await pumpApp(tester, h);

    for (final path in ['/auth', '/auth/otp']) {
      routerOf(h).go(path);
      await settle(tester);
      expect(homeWelcome, findsOneWidget, reason: path);
    }
  });

  testWidgets('a signed-in user can open the other signed-in screens', (
    tester,
  ) async {
    await storeSession();
    await pumpApp(tester, h);

    routerOf(h).go('/profile');
    await settle(tester);
    expect(find.text('Profile'), findsWidgets);
    expect(find.text('+94 77 123 4567'), findsOneWidget);
  });

  testWidgets(
    'signing out returns to the sign-in screen and forgets the session',
    (tester) async {
      await storeSession();
      await pumpApp(tester, h);

      // The home screen has grown past one screen's height; make the test
      // surface tall enough that every button, including sign-out, is laid
      // out and tappable without needing to scroll to it.
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pump();

      await tester.tap(find.byKey(const Key('sign_out_button')));
      await settle(tester);

      expect(phoneField, findsOneWidget);
      expect(homeWelcome, findsNothing);
      expect(h.storage.values, isEmpty);
      expect(h.auth.logoutCalls, ['refresh-1']);
    },
  );

  testWidgets(
    'protected screens are unreachable after signing out (no back button into the app)',
    (tester) async {
      await storeSession();
      await pumpApp(tester, h);
      routerOf(h).go('/profile');
      await settle(tester);

      await h.container.read(authControllerProvider.notifier).logout();
      await settle(tester);

      expect(phoneField, findsOneWidget);
      expect(find.text('+94 77 123 4567'), findsNothing);
    },
  );

  testWidgets('a session that the server ends moves the user to sign in', (
    tester,
  ) async {
    await storeSession();
    await pumpApp(tester, h);
    expect(homeWelcome, findsOneWidget);
    h.auth.onRefresh = (_) => throw const UnauthorizedException('no');

    await h.container.read(sessionManagerProvider).refresh();
    await settle(tester);

    expect(phoneField, findsOneWidget);
    expect(homeWelcome, findsNothing);
  });
}
