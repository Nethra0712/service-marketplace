import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/notifications/domain/notification_kind.dart';

import '../../../helpers/booking_fakes.dart';
import '../../../helpers/feature_harness.dart';
import '../../../helpers/notification_fakes.dart';
import '../../../helpers/pump_app.dart';

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

  testWidgets('shows an empty state with nothing to show', (tester) async {
    await f.open(tester, AppRoutes.notifications.path);
    expect(key('notifications_empty'), findsOneWidget);
  });

  testWidgets('lists notifications, newest first as the server sent them', (
    tester,
  ) async {
    f.notification.items = [
      notificationOf(id: 'n1', title: 'Booking accepted'),
      notificationOf(
        id: 'n2',
        kind: NotificationKind.providerEnRoute,
        title: 'Provider on the way',
      ),
    ];

    await f.open(tester, AppRoutes.notifications.path);

    expect(key('notification_n1'), findsOneWidget);
    expect(key('notification_n2'), findsOneWidget);
    expect(find.text('Booking accepted'), findsOneWidget);
  });

  testWidgets('tapping an unread notification marks it read', (tester) async {
    f.notification.items = [notificationOf(id: 'n1')];

    await f.open(tester, AppRoutes.notifications.path);
    await tapKey(tester, 'notification_n1');

    expect(f.notification.readIds, ['n1']);
  });

  testWidgets('tapping a booking-related notification navigates to it', (
    tester,
  ) async {
    f.booking.bookings.add(bookingOf(id: 'b1'));
    f.notification.items = [notificationOf(id: 'n1', bookingId: 'b1')];

    await f.open(tester, AppRoutes.notifications.path);
    await tapKey(tester, 'notification_n1');

    expect(key('booking_status'), findsOneWidget);
  });

  testWidgets('mark-all-read button is hidden when nothing is unread', (
    tester,
  ) async {
    f.notification.items = [
      notificationOf(id: 'n1', readAt: DateTime.utc(2026, 1, 1, 12)),
    ];
    await f.open(tester, AppRoutes.notifications.path);
    expect(key('mark_all_read_button'), findsNothing);
  });

  testWidgets('mark-all-read button marks everything read', (tester) async {
    f.notification.items = [notificationOf(id: 'n2')];
    await f.open(tester, AppRoutes.notifications.path);
    expect(key('mark_all_read_button'), findsOneWidget);

    await tapKey(tester, 'mark_all_read_button');
    expect(f.notification.markedAllRead, isTrue);
  });

  testWidgets('a load failure is shown, not silently swallowed', (
    tester,
  ) async {
    f.notification.failures['listNotifications'] = const NetworkException(
      'offline',
    );
    await f.open(tester, AppRoutes.notifications.path);
    expect(find.text(en.errorNetwork), findsOneWidget);
  });
}
