import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/features/notifications/domain/device_platform.dart';
import 'package:mobile/features/notifications/domain/push_notification_service.dart';

import '../../helpers/booking_fakes.dart';
import '../../helpers/feature_harness.dart';
import '../../helpers/notification_fakes.dart';
import '../../helpers/pump_app.dart';

void main() {
  final en = lookupAppLocalizations(const Locale('en'));

  late FeatureHarness f;
  setUp(() => f = FeatureHarness());
  tearDown(() => f.dispose());

  Finder key(String value) => find.byKey(Key(value));

  Future<void> tapKey(WidgetTester tester, String value) async {
    await tester.ensureVisible(key(value));
    await tester.tap(key(value));
    await settle(tester);
  }

  /// A screen tall enough that every home-screen action is laid out without
  /// needing to scroll to it.
  void tallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  group('token lifecycle', () {
    testWidgets(
      'a token already available from an earlier session is registered on sign-in',
      (tester) async {
        f.push.token = 'device-token-1';

        await f.open(tester);

        expect(
          f.notification.registeredTokens['device-token-1'],
          DevicePlatform.android,
        );
      },
    );

    testWidgets('a token refresh re-registers the new token', (tester) async {
      f.push.token = 'device-token-1';
      await f.open(tester);
      expect(
        f.notification.registeredTokens.containsKey('device-token-1'),
        isTrue,
      );

      f.push.tokenRefreshController.add('device-token-2');
      await settle(tester);

      expect(
        f.notification.registeredTokens.containsKey('device-token-2'),
        isTrue,
      );
    });

    testWidgets('signing out removes the device token', (tester) async {
      tallScreen(tester);
      f.push.token = 'device-token-1';
      await f.open(tester);
      await tapKey(tester, 'sign_out_button');

      expect(f.notification.removedTokens, contains('device-token-1'));
    });
  });

  group('permission flow', () {
    testWidgets('shows an explainer before ever registering a token', (
      tester,
    ) async {
      f.push.token = null; // Nothing obtainable yet: permission not granted.

      await f.open(tester);

      expect(key('notification_permission_banner'), findsOneWidget);
      expect(f.notification.registeredTokens, isEmpty);
    });

    testWidgets(
      'tapping "turn on" requests permission and registers the resulting token',
      (tester) async {
        f.push.token = null;
        await f.open(tester);
        expect(key('notification_permission_banner'), findsOneWidget);

        // What the OS would hand back once the person grants permission.
        f.push.token = 'device-token-1';
        await tapKey(tester, 'notification_permission_allow_button');

        expect(
          f.notification.registeredTokens.containsKey('device-token-1'),
          isTrue,
        );
        expect(key('notification_permission_banner'), findsNothing);
      },
    );

    testWidgets('"not now" hides the banner without registering anything', (
      tester,
    ) async {
      f.push.token = null;
      await f.open(tester);

      await tapKey(tester, 'notification_permission_dismiss_button');

      expect(key('notification_permission_banner'), findsNothing);
      expect(f.notification.registeredTokens, isEmpty);
    });

    testWidgets('never shown once push is already enabled', (tester) async {
      f.push.token = 'device-token-1';
      await f.open(tester);
      expect(key('notification_permission_banner'), findsNothing);
    });
  });

  group('push message handling', () {
    testWidgets('a foreground push refreshes the unread badge', (tester) async {
      await f.open(tester);
      expect(find.text('1'), findsNothing);

      f.notification.items = [notificationOf(id: 'n1')];
      f.push.foregroundController.add(
        const RemoteMessagePayload(
          title: 'Booking accepted',
          body: 'A provider has accepted your booking.',
          data: {'kind': 'booking_accepted', 'bookingId': 'b1'},
        ),
      );
      await settle(tester);

      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('a foreground push shows a snackbar with its title', (
      tester,
    ) async {
      await f.open(tester);

      f.push.foregroundController.add(
        const RemoteMessagePayload(
          title: 'Booking accepted',
          body: 'A provider has accepted your booking.',
          data: {'kind': 'booking_accepted', 'bookingId': 'b1'},
        ),
      );
      await settle(tester);

      expect(find.text('Booking accepted'), findsOneWidget);
    });

    testWidgets(
      'tapping a booking-related push (opened from background) deep-links to the booking',
      (tester) async {
        f.booking.bookings.add(bookingOf(id: 'b1', categoryName: 'Cleaning'));
        await f.open(tester);

        f.push.openedController.add(
          const RemoteMessagePayload(
            title: 'Booking accepted',
            body: 'A provider has accepted your booking.',
            data: {'kind': 'booking_accepted', 'bookingId': 'b1'},
          ),
        );
        await settle(tester);

        expect(key('booking_status'), findsOneWidget);
      },
    );

    testWidgets(
      'tapping a payout push (no booking) opens the notification list instead',
      (tester) async {
        await f.open(tester);

        f.push.openedController.add(
          const RemoteMessagePayload(
            title: 'Payout sent',
            body: 'Your payout has been sent.',
            data: {'kind': 'payout_paid'},
          ),
        );
        await settle(tester);

        expect(find.text(en.notificationsTitle), findsWidgets);
      },
    );
  });
}
