import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';

import '../../../helpers/booking_fakes.dart';
import '../../../helpers/feature_harness.dart';
import '../../../helpers/pump_app.dart';

void main() {
  final en = lookupAppLocalizations(const Locale('en'));

  late FeatureHarness f;
  setUp(() => f = FeatureHarness());
  tearDown(() => f.dispose());

  Finder key(String value) => find.byKey(Key(value));

  testWidgets('is reachable from the home screen', (tester) async {
    await f.open(tester);

    await tester.tap(key('my_bookings_button'));
    await settle(tester);

    expect(find.text(en.bookingHistoryTitle), findsOneWidget);
  });

  testWidgets('splits bookings into active and past tabs', (tester) async {
    f.booking.bookings.addAll([
      bookingOf(id: 'a', status: BookingStatus.searching),
      bookingOf(id: 'b', status: BookingStatus.enRoute),
      bookingOf(id: 'c', status: BookingStatus.completed),
      bookingOf(id: 'd', status: BookingStatus.cancelled),
    ]);

    await f.open(tester, AppRoutes.bookings.path);

    // Active tab is shown first.
    expect(key('booking_a'), findsOneWidget);
    expect(key('booking_b'), findsOneWidget);
    expect(key('booking_c'), findsNothing);
    expect(key('booking_d'), findsNothing);

    await tester.tap(find.text(en.bookingHistoryPast));
    await settle(tester);

    expect(key('booking_c'), findsOneWidget);
    expect(key('booking_d'), findsOneWidget);
    expect(key('booking_a'), findsNothing);
  });

  testWidgets('shows a message when a tab is empty', (tester) async {
    await f.open(tester, AppRoutes.bookings.path);

    expect(key('bookings_empty'), findsOneWidget);
    expect(find.text(en.bookingHistoryActiveEmpty), findsOneWidget);
  });

  testWidgets('opens a booking\'s detail on tap', (tester) async {
    f.booking.bookings.add(bookingOf(id: 'a', categoryName: 'Cleaning'));

    await f.open(tester, AppRoutes.bookings.path);
    await tester.tap(key('booking_a'));
    await settle(tester);

    expect(key('booking_status'), findsOneWidget);
  });

  testWidgets('a load failure shows an error, and retry recovers', (
    tester,
  ) async {
    f.booking.failures['listMine'] = const NetworkException('offline');

    await f.open(tester, AppRoutes.bookings.path);

    expect(find.text(en.errorNetwork), findsOneWidget);

    f.booking.bookings.add(bookingOf(id: 'a'));
    await tester.tap(key('retry_button'));
    await settle(tester);

    expect(key('booking_a'), findsOneWidget);
  });

  testWidgets('requires authentication', (tester) async {
    f = FeatureHarness(signedIn: false);
    await f.open(tester);

    routerOf(f.auth).go(AppRoutes.bookings.path);
    await settle(tester);

    expect(phoneField, findsOneWidget);
  });
}
