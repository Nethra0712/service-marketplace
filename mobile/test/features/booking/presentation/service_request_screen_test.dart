import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';

import '../../../helpers/catalogue_fakes.dart';
import '../../../helpers/feature_harness.dart';
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

  testWidgets('is reachable from a service\'s detail page', (tester) async {
    await f.open(tester, AppRoutes.serviceDetailLocation('cleaning'));

    await tapKey(tester, 'request_service_button');

    expect(find.text(en.serviceRequestTitle), findsOneWidget);
  });

  testWidgets('creates an on-demand request by default', (tester) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    await tester.enterText(key('address_field'), '12 Galle Road');
    await tapKey(tester, 'submit_request_button');

    expect(f.booking.createCalls, hasLength(1));
    final input = f.booking.createCalls.single;
    expect(input.categorySlug, 'cleaning');
    expect(input.citySlug, 'colombo');
    expect(input.bookingType, BookingType.onDemand);
    expect(input.scheduledAt, isNull);
    expect(input.serviceAddress, '12 Galle Road');
    expect(find.text(en.serviceRequestSent), findsOneWidget);
  });

  testWidgets('lands on the new booking\'s detail screen', (tester) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    await tester.enterText(key('address_field'), '12 Galle Road');
    await tapKey(tester, 'submit_request_button');

    expect(key('booking_status'), findsOneWidget);
    expect(key('address_field'), findsNothing); // left the form
  });

  testWidgets('sends the trimmed optional notes', (tester) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    await tester.enterText(key('address_field'), '1 Test Road');
    await tester.enterText(key('notes_field'), '  Ring twice.  ');
    await tapKey(tester, 'submit_request_button');

    expect(f.booking.createCalls.single.customerNotes, '  Ring twice.  ');
  });

  testWidgets('requires the address', (tester) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    await tapKey(tester, 'submit_request_button');

    expect(find.text(en.serviceRequestAddressRequired), findsOneWidget);
    expect(f.booking.createCalls, isEmpty);
  });

  testWidgets('scheduling requires picking a time before submitting', (
    tester,
  ) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));
    await tester.enterText(key('address_field'), '1 Test Road');

    await tester.tap(find.text(en.serviceRequestScheduled));
    await settle(tester);
    expect(key('pick_scheduled_time_button'), findsOneWidget);

    await tapKey(tester, 'submit_request_button');

    expect(find.text(en.serviceRequestScheduledTimeInvalid), findsOneWidget);
    expect(f.booking.createCalls, isEmpty);
  });

  testWidgets('offers cleaning in Colombo, with no city picker for one city', (
    tester,
  ) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    expect(find.text('Cleaning'), findsOneWidget);
    expect(key('city_dropdown'), findsNothing);
  });

  testWidgets(
    'shows a city picker when a service is offered in more than one city',
    (tester) async {
      f = FeatureHarness(
        catalogue: FakeCatalogueRepository(cities: const [colombo, kandy]),
      );
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      expect(key('city_dropdown'), findsOneWidget);
    },
  );

  testWidgets('a service not available anywhere shows the empty state', (
    tester,
  ) async {
    f.catalogue.hidden.add('cleaning');

    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    expect(find.text(en.serviceDetailNotAvailable), findsOneWidget);
    expect(key('submit_request_button'), findsNothing);
  });

  testWidgets('a server failure is shown and the form is kept', (tester) async {
    f.booking.failures['create'] = const NetworkException('offline');
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));
    await tester.enterText(key('address_field'), '1 Test Road');

    await tapKey(tester, 'submit_request_button');

    expect(find.text(en.errorNetwork), findsOneWidget);
    expect(key('address_field'), findsOneWidget);
    expect(
      tester.widget<TextFormField>(key('address_field')).controller!.text,
      '1 Test Road',
    );
  });

  testWidgets('a blank address is rejected even after whitespace only', (
    tester,
  ) async {
    await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

    await tester.enterText(key('address_field'), '    ');
    await tapKey(tester, 'submit_request_button');

    expect(find.text(en.serviceRequestAddressRequired), findsOneWidget);
    expect(f.booking.createCalls, isEmpty);
  });

  group('precise location', () {
    testWidgets('captures and sends the current location', (tester) async {
      f.locationService.status = LocationPermissionStatus.granted;
      f.locationService.currentLocation = const LocationReading(
        latitude: 6.9271,
        longitude: 79.8612,
      );
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      await tapKey(tester, 'use_my_location_button');

      expect(find.text(en.serviceRequestLocationSet), findsOneWidget);
      expect(key('use_my_location_button'), findsNothing);
      expect(key('clear_location_button'), findsOneWidget);

      await tester.enterText(key('address_field'), '1 Test Road');
      await tapKey(tester, 'submit_request_button');

      final sent = f.booking.createCalls.single.serviceLocation;
      expect(sent?.latitude, 6.9271);
      expect(sent?.longitude, 79.8612);
    });

    testWidgets('can be cleared after being set', (tester) async {
      f.locationService.status = LocationPermissionStatus.granted;
      f.locationService.currentLocation = const LocationReading(
        latitude: 6.9271,
        longitude: 79.8612,
      );
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));
      await tapKey(tester, 'use_my_location_button');

      await tapKey(tester, 'clear_location_button');

      expect(key('use_my_location_button'), findsOneWidget);
      await tester.enterText(key('address_field'), '1 Test Road');
      await tapKey(tester, 'submit_request_button');
      expect(f.booking.createCalls.single.serviceLocation, isNull);
    });

    testWidgets('offers to retry when permission is merely denied', (
      tester,
    ) async {
      f.locationService.status = LocationPermissionStatus.denied;
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      await tapKey(tester, 'use_my_location_button');

      expect(find.text(en.locationPermissionDenied), findsOneWidget);
      expect(find.text(en.locationRetry), findsOneWidget);
    });

    testWidgets('offers to open settings when permission is denied forever', (
      tester,
    ) async {
      f.locationService.status = LocationPermissionStatus.deniedForever;
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      await tapKey(tester, 'use_my_location_button');

      expect(find.text(en.locationPermissionDeniedForever), findsOneWidget);
      await tester.tap(find.text(en.locationOpenSettings));
      await settle(tester);
      expect(f.locationService.openAppSettingsCalls, 1);
    });

    testWidgets('offers to enable GPS when the location service is off', (
      tester,
    ) async {
      f.locationService.status = LocationPermissionStatus.serviceDisabled;
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      await tapKey(tester, 'use_my_location_button');

      expect(find.text(en.locationServiceDisabled), findsOneWidget);
      await tester.tap(find.text(en.locationEnableGps));
      await settle(tester);
      expect(f.locationService.openLocationSettingsCalls, 1);
    });

    testWidgets('is not required to submit the request', (tester) async {
      await f.open(tester, AppRoutes.serviceRequestLocation('cleaning'));

      await tester.enterText(key('address_field'), '1 Test Road');
      await tapKey(tester, 'submit_request_button');

      expect(f.booking.createCalls.single.serviceLocation, isNull);
    });
  });
}
