import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/provider/domain/provider_profile.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

import '../../../helpers/booking_fakes.dart';
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
}
