import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/location/location_permission_status.dart';
import 'package:mobile/core/location/location_reading.dart';
import 'package:mobile/core/maps/map_point.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/booking/domain/offer.dart';
import 'package:mobile/features/payments/domain/payment_status.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';
import 'package:mobile/features/tracking/domain/tracking_socket.dart';

import '../../../helpers/booking_fakes.dart';
import '../../../helpers/feature_harness.dart';
import '../../../helpers/payment_fakes.dart';
import '../../../helpers/pump_app.dart';
import '../../../helpers/review_fakes.dart';

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

  /// A screen tall enough that provider action buttons are laid out without
  /// needing to scroll to them.
  void tallScreen(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  // The signed-in test user is 'user-1' (fakes.dart's testUser); a booking
  // fixture must belong to someone else to be seen as a provider would see it.
  const otherCustomer = BookingParty(
    id: 'customer-2',
    fullName: 'Other Customer',
  );

  group('customer view', () {
    testWidgets('shows the booking\'s details', (tester) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          categoryName: 'Cleaning',
          cityName: 'Colombo',
          serviceAddress: '12 Galle Road',
          customerNotes: 'Ring the bell twice.',
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(find.text('Cleaning'), findsWidgets);
      expect(find.text('Colombo'), findsOneWidget);
      expect(find.text('12 Galle Road'), findsOneWidget);
      expect(find.text('Ring the bell twice.'), findsOneWidget);
      expect(key('booking_status'), findsOneWidget);
    });

    testWidgets('shows the agreed price once one is set', (tester) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          agreedAmount: '3500.00',
          provider: const BookingParty(id: 'p1', fullName: 'Kamal'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('agreed_amount'), findsOneWidget);
      expect(find.text(en.bookingAmountLkr('3500.00')), findsOneWidget);
    });

    testWidgets('can cancel while searching', (tester) async {
      f.booking.bookings.add(bookingOf(id: 'b1'));
      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      await tapKey(tester, 'cancel_booking_button');
      await tester.enterText(key('reason_field'), 'Changed my mind.');
      await tapKey(tester, 'reason_dialog_confirm');

      expect(f.booking.bookings.single.status, BookingStatus.cancelled);
      expect(find.text(en.bookingCancelled), findsOneWidget);
    });

    testWidgets('an empty reason does not confirm the cancel dialog', (
      tester,
    ) async {
      f.booking.bookings.add(bookingOf(id: 'b1'));
      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      await tapKey(tester, 'cancel_booking_button');
      await tapKey(tester, 'reason_dialog_confirm');

      expect(key('reason_field'), findsOneWidget); // dialog still open
      expect(f.booking.bookings.single.status, BookingStatus.searching);
    });

    testWidgets('cancelling can be backed out of', (tester) async {
      f.booking.bookings.add(bookingOf(id: 'b1'));
      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      await tapKey(tester, 'cancel_booking_button');
      await tapKey(tester, 'reason_dialog_cancel');

      expect(key('reason_field'), findsNothing);
      expect(f.booking.bookings.single.status, BookingStatus.searching);
    });

    testWidgets('no cancel button once in progress', (tester) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.inProgress,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('cancel_booking_button'), findsNothing);
    });

    testWidgets('shows the cancellation reason once cancelled', (tester) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.cancelled,
          cancellation: Cancellation(
            at: DateTime.utc(2026, 1, 1, 12),
            byUserId: 'user-1',
            reason: 'Found someone else.',
          ),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(
        find.text(en.bookingCancelReason('Found someone else.')),
        findsOneWidget,
      );
      expect(key('cancel_booking_button'), findsNothing);
    });

    testWidgets('shows "no provider found" once matching expires', (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.expired),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(find.text(en.bookingStatusExpired), findsOneWidget);
      expect(key('cancel_booking_button'), findsNothing);
    });
  });

  group('quote-priced booking, customer view', () {
    testWidgets('shows every quote and lets the customer accept one', (
      tester,
    ) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          pricingModel: PricingModel.quote,
          quotes: [
            quoteOf(id: 'q1', amount: '3000.00', providerName: 'Kamal Silva'),
            quoteOf(id: 'q2', amount: '3200.00', providerName: 'Sunil Perera'),
          ],
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('quote_q1'), findsOneWidget);
      expect(key('quote_q2'), findsOneWidget);
      expect(find.text('Kamal Silva'), findsOneWidget);

      await tapKey(tester, 'accept_quote_q1');

      expect(f.booking.bookings.single.status, BookingStatus.accepted);
      expect(f.booking.bookings.single.provider?.id, 'provider-profile-1');
    });

    testWidgets('lets the customer decline a quote', (tester) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          pricingModel: PricingModel.quote,
          quotes: [quoteOf(id: 'q1')],
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      await tapKey(tester, 'reject_quote_q1');

      expect(find.text(en.bookingQuoteRejected), findsOneWidget);
    });

    testWidgets('says so when there are no quotes yet', (tester) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', pricingModel: PricingModel.quote),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('no_quotes'), findsOneWidget);
    });
  });

  group('assigned provider view', () {
    Future<void> asProvider(WidgetTester tester, Booking booking) async {
      f.provider.profile = ProviderProfile(
        id: booking.provider!.id,
        verificationStatus: VerificationStatus.verified,
        fullName: 'Kamal Silva',
      );
      f.booking.bookings.add(booking);
      await f.open(tester, AppRoutes.bookingDetailLocation(booking.id));
    }

    testWidgets('walks the job through to completion', (tester) async {
      tallScreen(tester);
      await asProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await tapKey(tester, 'start_en_route_button');
      expect(f.booking.bookings.single.status, BookingStatus.enRoute);

      await tapKey(tester, 'mark_arrived_button');
      expect(f.booking.bookings.single.status, BookingStatus.arrived);

      await tapKey(tester, 'start_work_button');
      expect(f.booking.bookings.single.status, BookingStatus.inProgress);

      await tapKey(tester, 'complete_button');
      // Each step's snackbar may still be settling from the one before, so
      // only the state itself (not a specific stacked snackbar) is asserted
      // here; a single action's snackbar is checked in its own test below.
      expect(f.booking.bookings.single.status, BookingStatus.completed);
    });

    testWidgets('completing shows its own confirmation', (tester) async {
      tallScreen(tester);
      await asProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.inProgress,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await tapKey(tester, 'complete_button');

      expect(f.booking.bookings.single.status, BookingStatus.completed);
      expect(find.text(en.bookingCompletedMessage), findsOneWidget);
    });

    testWidgets('can release the job while still accepted', (tester) async {
      tallScreen(tester);
      await asProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await tapKey(tester, 'release_booking_button');
      await tester.enterText(key('reason_field'), 'Vehicle broke down.');
      await tapKey(tester, 'reason_dialog_confirm');

      expect(f.booking.bookings.single.status, BookingStatus.searching);
      expect(f.booking.bookings.single.provider, isNull);
    });

    testWidgets('cannot release once work has started', (tester) async {
      tallScreen(tester);
      await asProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.inProgress,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      expect(key('release_booking_button'), findsNothing);
      expect(key('complete_button'), findsOneWidget);
    });
  });

  group('candidate provider view (open booking, not yet assigned)', () {
    testWidgets('a fixed/hourly job can be accepted directly', (tester) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.hourly,
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('accept_booking_button'), findsOneWidget);
      await tapKey(tester, 'accept_booking_button');

      expect(f.booking.bookings.single.status, BookingStatus.accepted);
      expect(find.text(en.bookingAcceptedMessage), findsOneWidget);
    });

    testWidgets('a quote-priced job offers "submit a quote" instead', (
      tester,
    ) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.quote,
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('accept_booking_button'), findsNothing);
      expect(key('submit_quote_button'), findsOneWidget);

      await tapKey(tester, 'submit_quote_button');
      await tester.enterText(key('quote_amount_field'), '3500');
      await tester.enterText(key('quote_note_field'), 'Two hours.');
      await tapKey(tester, 'quote_dialog_confirm');

      expect(f.booking.bookings.single.quotes, hasLength(1));
      expect(f.booking.bookings.single.quotes.single.amount, '3500.00');
      expect(find.text(en.bookingQuoteSubmitted), findsOneWidget);
    });

    testWidgets('a zero or blank quote amount is refused client-side', (
      tester,
    ) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.quote,
        ),
      );
      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      await tapKey(tester, 'submit_quote_button');
      await tapKey(tester, 'quote_dialog_confirm');

      expect(
        f.booking.bookings.single.quotes,
        isEmpty,
      ); // dialog still open, nothing sent
    });

    testWidgets('once quoted, the submit button is replaced', (tester) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.quote,
          quotes: [quoteOf(id: 'q1', providerId: 'p1')],
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('submit_quote_button'), findsNothing);
      expect(key('decline_offer_button'), findsNothing);
    });

    testWidgets('can decline a fixed/hourly offer', (tester) async {
      tallScreen(tester);
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.hourly,
          myOffer: offerOf(),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('decline_offer_button'), findsOneWidget);
      await tapKey(tester, 'decline_offer_button');

      expect(f.booking.bookings.single.myOffer?.status, OfferStatus.declined);
      expect(find.text(en.bookingOfferDeclined), findsOneWidget);
    });

    testWidgets('can decline a quote-priced offer before quoting', (
      tester,
    ) async {
      tallScreen(tester);
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.quote,
          myOffer: offerOf(),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      await tapKey(tester, 'decline_offer_button');

      expect(f.booking.bookings.single.myOffer?.status, OfferStatus.declined);
    });

    testWidgets('shows when the offer must be answered by', (tester) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.searching,
          customer: otherCustomer,
          pricingModel: PricingModel.hourly,
          myOffer: offerOf(respondsBy: DateTime.utc(2026, 1, 1, 9, 30)),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('offer_respond_by'), findsOneWidget);
    });
  });

  group('live tracking, customer view', () {
    const serviceLocation = MapPoint(latitude: 6.9271, longitude: 79.8612);

    testWidgets('is not shown for a non-trackable booking', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.searching),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('connection_badge'), findsNothing);
    });

    testWidgets('shows a waiting message before any location is known', (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('waiting_for_location'), findsOneWidget);
    });

    testWidgets("shows the provider's last known location on join", (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1'),
        ),
      );
      f.tracking.joinResults['b1'] = BookingRoomInfo(
        role: BookingRoomRole.customer,
        lastLocation: TrackedLocation(
          latitude: 6.9019,
          longitude: 79.8607,
          at: DateTime.utc(2026, 1, 1, 9),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('map_marker_provider'), findsOneWidget);
    });

    testWidgets('shows distance and ETA once both locations are known', (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1'),
          serviceLocation: serviceLocation,
        ),
      );
      f.tracking.joinResults['b1'] = BookingRoomInfo(
        role: BookingRoomRole.customer,
        lastLocation: TrackedLocation(
          latitude: 6.9019,
          longitude: 79.8607,
          at: DateTime.utc(2026, 1, 1, 9),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('distance_eta'), findsOneWidget);
    });

    testWidgets('updates live as a new reading arrives over the socket', (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      expect(key('map_marker_provider'), findsNothing);

      f.tracking.emitLocation(
        'b1',
        TrackedLocation(
          latitude: 6.9019,
          longitude: 79.8607,
          at: DateTime.utc(2026, 1, 1, 9),
        ),
      );
      await settle(tester);

      expect(key('map_marker_provider'), findsOneWidget);
    });

    testWidgets('shows the connection state', (tester) async {
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      f.tracking.emitConnectionState(TrackingConnectionState.connected);
      await settle(tester);

      expect(find.text(en.trackingLive), findsOneWidget);
    });
  });

  group('live tracking, provider view', () {
    Future<void> asOnlineProvider(
      WidgetTester tester,
      Booking booking, {
      LocationPermissionStatus locationStatus =
          LocationPermissionStatus.granted,
    }) async {
      f.provider.profile = ProviderProfile(
        id: booking.provider!.id,
        verificationStatus: VerificationStatus.verified,
        availability: ProviderAvailability.online,
      );
      f.locationService.status = locationStatus;
      f.booking.bookings.add(booking);
      await f.open(tester, AppRoutes.bookingDetailLocation(booking.id));
    }

    testWidgets('shares location while online and the booking is trackable', (
      tester,
    ) async {
      await asOnlineProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      expect(key('sharing_location_indicator'), findsOneWidget);
      expect(key('not_sharing_location_indicator'), findsNothing);
    });

    testWidgets('does not share location while offline', (tester) async {
      f.provider.profile = ProviderProfile(
        id: 'p1',
        verificationStatus: VerificationStatus.verified,
        // availability defaults to offline.
      );
      f.booking.bookings.add(
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('not_sharing_location_indicator'), findsOneWidget);
      expect(key('sharing_location_indicator'), findsNothing);
    });

    testWidgets('shows a permission-denied view when location is denied', (
      tester,
    ) async {
      await asOnlineProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
        locationStatus: LocationPermissionStatus.denied,
      );

      expect(key('location_permission_message'), findsOneWidget);
      expect(key('location_retry_button'), findsOneWidget);
    });

    testWidgets('sends readings to the socket while sharing', (tester) async {
      await asOnlineProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
        ),
      );

      f.locationService.emit(
        const LocationReading(latitude: 6.9019, longitude: 79.8607),
      );
      await settle(tester);

      expect(f.tracking.sentUpdates, hasLength(1));
      expect(f.tracking.sentUpdates.single.bookingId, 'b1');
    });

    testWidgets('shows a navigate button that opens the maps handoff', (
      tester,
    ) async {
      tallScreen(tester);
      await asOnlineProvider(
        tester,
        bookingOf(
          id: 'b1',
          status: BookingStatus.accepted,
          customer: otherCustomer,
          provider: const BookingParty(id: 'p1'),
          serviceLocation: const MapPoint(latitude: 6.9271, longitude: 79.8612),
        ),
      );

      await tapKey(tester, 'navigate_button');

      expect(f.urlLauncher.launchedUrls, hasLength(1));
      expect(
        f.urlLauncher.launchedUrls.single.queryParameters['destination'],
        '6.9271,79.8612',
      );
    });
  });

  group('payment section', () {
    testWidgets('is not shown before the booking is completed', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.accepted),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('payment_status'), findsNothing);
    });

    testWidgets(
      'shows the customer the breakdown and a pay-now button while pending',
      (tester) async {
        f.booking.bookings.add(
          bookingOf(id: 'b1', status: BookingStatus.completed),
        );
        f.payment.payments['b1'] = paymentOf(bookingId: 'b1');

        await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

        expect(key('payment_status'), findsOneWidget);
        expect(find.text(en.bookingAmountLkr('250.00')), findsOneWidget);
        expect(find.text(en.bookingAmountLkr('37.50')), findsOneWidget);
        expect(find.text(en.bookingAmountLkr('212.50')), findsOneWidget);
        expect(key('pay_now_button'), findsOneWidget);
      },
    );

    testWidgets('paying opens the checkout url and shows a confirmation', (
      tester,
    ) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.payment.payments['b1'] = paymentOf(bookingId: 'b1');

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      await tapKey(tester, 'pay_now_button');

      expect(f.payment.checkoutCalls, ['b1']);
      expect(f.urlLauncher.launchedUrls, hasLength(1));
      expect(find.text(en.paymentCheckoutOpened), findsOneWidget);
    });

    testWidgets('a checkout failure is shown, not silently swallowed', (
      tester,
    ) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.payment.payments['b1'] = paymentOf(bookingId: 'b1');
      f.payment.failures['createCheckout'] = const NetworkException('offline');

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      await tapKey(tester, 'pay_now_button');

      expect(find.text(en.errorNetwork), findsOneWidget);
    });

    testWidgets('a succeeded payment shows no pay button', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.payment.payments['b1'] = paymentOf(
        bookingId: 'b1',
        status: PaymentStatus.succeeded,
        providerPaymentId: 'gateway-ref-1',
        succeededAt: DateTime.utc(2026, 1, 1, 11, 5),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(find.text(en.paymentStatusSucceeded), findsOneWidget);
      expect(key('pay_now_button'), findsNothing);
    });

    testWidgets(
      'the assigned provider sees the breakdown too, with no pay button',
      (tester) async {
        f.provider.profile = ProviderProfile(
          id: 'p1',
          verificationStatus: VerificationStatus.verified,
        );
        f.booking.bookings.add(
          bookingOf(
            id: 'b1',
            status: BookingStatus.completed,
            customer: otherCustomer,
            provider: const BookingParty(id: 'p1'),
          ),
        );
        f.payment.payments['b1'] = paymentOf(bookingId: 'b1');

        await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

        expect(key('provider_earning_row'), findsOneWidget);
        expect(key('pay_now_button'), findsNothing);
      },
    );

    testWidgets('a load failure is shown', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.payment.failures['getPayment'] = const NetworkException('offline');

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('payment_error'), findsOneWidget);
    });
  });

  group('failures', () {
    testWidgets('a load failure shows an error, and retry recovers', (
      tester,
    ) async {
      f.booking.failures['getBooking'] = const NetworkException('offline');
      f.booking.bookings.add(bookingOf(id: 'b1'));

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(find.text(en.errorNetwork), findsOneWidget);
      expect(key('retry_button'), findsOneWidget);

      await tapKey(tester, 'retry_button');

      expect(key('booking_status'), findsOneWidget);
    });

    testWidgets('an action failure is shown without losing the current state', (
      tester,
    ) async {
      f.booking.bookings.add(bookingOf(id: 'b1'));
      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      f.booking.failures['cancel'] = const ApiException(
        'x',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      );

      await tapKey(tester, 'cancel_booking_button');
      await tester.enterText(key('reason_field'), 'x');
      await tapKey(tester, 'reason_dialog_confirm');

      expect(find.text(en.errorValidation), findsOneWidget);
      expect(f.booking.bookings.single.status, BookingStatus.searching);
    });
  });

  group('review section', () {
    testWidgets('is not shown before the booking is completed', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.accepted),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('review_rating_input'), findsNothing);
    });

    testWidgets('the customer can rate and submit a review', (tester) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      expect(key('review_rating_input'), findsOneWidget);

      await tapKey(tester, 'star_4');
      await tester.enterText(key('review_comment_field'), 'Great work!');
      await tapKey(tester, 'submit_review_button');

      expect(f.review.submitted, ['b1']);
      expect(find.text(en.reviewSubmitted), findsOneWidget);
      expect(f.review.reviews['b1']?.mine, isNotNull);
      expect(f.review.reviews['b1']?.mine?.rating, 4);
    });

    testWidgets('the submit button is disabled until a star is picked', (
      tester,
    ) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      final button = tester.widget<FilledButton>(key('submit_review_button'));
      expect(button.onPressed, isNull);
    });

    testWidgets(
      'an already-submitted review is shown read-only, not the form',
      (tester) async {
        f.booking.bookings.add(
          bookingOf(id: 'b1', status: BookingStatus.completed),
        );
        f.review.reviews['b1'] = BookingReviews(
          mine: reviewOf(id: 'r1', bookingId: 'b1', rating: 5),
        );

        await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

        expect(key('review_r1'), findsOneWidget);
        expect(find.text(en.reviewYourReview), findsOneWidget);
        expect(key('review_rating_input'), findsNothing);
      },
    );

    testWidgets("shows the counterpart's review once they have submitted one", (
      tester,
    ) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.review.reviews['b1'] = BookingReviews(
        mine: reviewOf(id: 'r1', bookingId: 'b1', rating: 5),
        theirs: reviewOf(
          id: 'r2',
          bookingId: 'b1',
          rating: 4,
          comment: null,
          isMine: false,
        ),
      );

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(find.text(en.reviewCounterpartReview), findsOneWidget);
      expect(key('review_r2'), findsOneWidget);
      expect(find.text(en.reviewNoComment), findsOneWidget);
    });

    testWidgets('a submit failure is shown, not silently swallowed', (
      tester,
    ) async {
      tallScreen(tester);
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.review.failures['submitReview'] = const NetworkException('offline');

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));
      await tapKey(tester, 'star_3');
      await tapKey(tester, 'submit_review_button');

      expect(find.text(en.errorNetwork), findsOneWidget);
    });

    testWidgets('a load failure is shown', (tester) async {
      f.booking.bookings.add(
        bookingOf(id: 'b1', status: BookingStatus.completed),
      );
      f.review.failures['getForBooking'] = const NetworkException('offline');

      await f.open(tester, AppRoutes.bookingDetailLocation('b1'));

      expect(key('review_error'), findsOneWidget);
    });
  });
}
