import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/features/booking/domain/booking.dart';
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

    await tester.tap(key('provider_jobs_button'));
    await settle(tester);

    expect(find.text(en.providerJobsTitle), findsOneWidget);
  });

  testWidgets('the open tab lists searching bookings, not assigned ones', (
    tester,
  ) async {
    f.booking.bookings.addAll([
      bookingOf(id: 'open-1', status: BookingStatus.searching),
      bookingOf(
        id: 'assigned-1',
        status: BookingStatus.accepted,
        provider: const BookingParty(id: 'p1'),
      ),
    ]);

    await f.open(tester, AppRoutes.providerJobs.path);

    expect(key('job_open-1'), findsOneWidget);
    expect(key('job_assigned-1'), findsNothing);
  });

  testWidgets('the assigned tab lists only jobs with a provider', (
    tester,
  ) async {
    f.booking.bookings.addAll([
      bookingOf(id: 'open-1', status: BookingStatus.searching),
      bookingOf(
        id: 'assigned-1',
        status: BookingStatus.accepted,
        provider: const BookingParty(id: 'p1'),
      ),
    ]);

    await f.open(tester, AppRoutes.providerJobs.path);
    await tester.tap(find.text(en.providerJobsAssigned));
    await settle(tester);

    expect(key('job_assigned-1'), findsOneWidget);
    expect(key('job_open-1'), findsNothing);
  });

  testWidgets('shows the customer\'s name on assigned jobs, not open ones', (
    tester,
  ) async {
    f.booking.bookings.addAll([
      bookingOf(
        id: 'open-1',
        status: BookingStatus.searching,
        customer: const BookingParty(id: 'c1', fullName: 'Priya'),
      ),
      bookingOf(
        id: 'assigned-1',
        status: BookingStatus.accepted,
        customer: const BookingParty(id: 'c1', fullName: 'Priya'),
        provider: const BookingParty(id: 'p1'),
      ),
    ]);

    await f.open(tester, AppRoutes.providerJobs.path);
    expect(find.textContaining('Priya'), findsNothing); // open tab: no name

    await tester.tap(find.text(en.providerJobsAssigned));
    await settle(tester);
    expect(find.textContaining('Priya'), findsOneWidget);
  });

  testWidgets('shows empty-state messages independently per tab', (
    tester,
  ) async {
    await f.open(tester, AppRoutes.providerJobs.path);

    expect(find.text(en.providerJobsOpenEmpty), findsOneWidget);

    await tester.tap(find.text(en.providerJobsAssigned));
    await settle(tester);

    expect(find.text(en.providerJobsAssignedEmpty), findsOneWidget);
  });

  testWidgets('opens a job\'s detail on tap', (tester) async {
    f.booking.bookings.add(
      bookingOf(id: 'open-1', status: BookingStatus.searching),
    );
    f.provider.profile = null;

    await f.open(tester, AppRoutes.providerJobs.path);
    await tester.tap(key('job_open-1'));
    await settle(tester);

    expect(key('booking_status'), findsOneWidget);
  });

  testWidgets('requires authentication', (tester) async {
    f = FeatureHarness(signedIn: false);
    await f.open(tester);

    routerOf(f.auth).go(AppRoutes.providerJobs.path);
    await settle(tester);

    expect(phoneField, findsOneWidget);
  });
}
