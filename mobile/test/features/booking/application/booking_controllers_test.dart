import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderListenable;
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/booking/application/booking_providers.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';

import '../../../helpers/booking_fakes.dart';
import '../../../helpers/fakes.dart';

void main() {
  late FakeBookingRepository repo;
  late AuthHarness h;
  late ProviderContainer c;

  setUp(() async {
    repo = FakeBookingRepository();
    h = AuthHarness(
      extraOverrides: [bookingRepositoryProvider.overrideWithValue(repo)],
    );
    c = h.container;
    // Let the launch-time session check finish first.
    await c.read(authControllerProvider.notifier).ready;
  });
  tearDown(() => h.dispose());

  void keepAlive(ProviderListenable<Object?> provider) {
    final sub = c.listen(provider, (_, _) {});
    addTearDown(sub.close);
  }

  group('MyBookingsController', () {
    test('loads the customer\'s bookings', () async {
      repo.bookings.add(bookingOf(id: 'a'));
      keepAlive(myBookingsProvider);

      final list = await c.read(myBookingsProvider.future);

      expect(list.map((b) => b.id), ['a']);
    });

    test('upsert replaces a booking already in the list', () async {
      repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
      keepAlive(myBookingsProvider);
      await c.read(myBookingsProvider.future);

      c
          .read(myBookingsProvider.notifier)
          .upsert(bookingOf(id: 'a', status: BookingStatus.cancelled));

      expect(
        c.read(myBookingsProvider).value!.single.status,
        BookingStatus.cancelled,
      );
    });

    test('upsert ignores a booking not already in the list', () async {
      keepAlive(myBookingsProvider);
      await c.read(myBookingsProvider.future);

      c.read(myBookingsProvider.notifier).upsert(bookingOf(id: 'never-loaded'));

      expect(c.read(myBookingsProvider).value, isEmpty);
    });
  });

  group('BookingDetailController', () {
    test('loads one booking by id', () async {
      repo.bookings.add(bookingOf(id: 'a', serviceAddress: '5 Flower Road'));
      keepAlive(bookingDetailProvider('a'));

      final booking = await c.read(bookingDetailProvider('a').future);

      expect(booking.serviceAddress, '5 Flower Road');
    });

    test(
      'accept moves the booking to accepted and assigns a provider',
      () async {
        repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
        keepAlive(bookingDetailProvider('a'));
        await c.read(bookingDetailProvider('a').future);

        await c.read(bookingDetailProvider('a').notifier).accept();

        final updated = c.read(bookingDetailProvider('a')).value!;
        expect(updated.status, BookingStatus.accepted);
        expect(updated.provider, isNotNull);
      },
    );

    test(
      'the full provider progression updates status and timestamps',
      () async {
        repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
        keepAlive(bookingDetailProvider('a'));
        await c.read(bookingDetailProvider('a').future);
        final notifier = c.read(bookingDetailProvider('a').notifier);

        await notifier.accept();
        await notifier.startEnRoute();
        expect(
          c.read(bookingDetailProvider('a')).value!.status,
          BookingStatus.enRoute,
        );
        expect(
          c.read(bookingDetailProvider('a')).value!.timestamps.enRouteAt,
          isNotNull,
        );

        await notifier.markArrived();
        expect(
          c.read(bookingDetailProvider('a')).value!.status,
          BookingStatus.arrived,
        );

        await notifier.startWork();
        expect(
          c.read(bookingDetailProvider('a')).value!.status,
          BookingStatus.inProgress,
        );

        await notifier.complete();
        expect(
          c.read(bookingDetailProvider('a')).value!.status,
          BookingStatus.completed,
        );
        expect(
          c.read(bookingDetailProvider('a')).value!.timestamps.completedAt,
          isNotNull,
        );
      },
    );

    test('release returns the booking to searching, unassigned', () async {
      repo.bookings.add(
        bookingOf(
          id: 'a',
          status: BookingStatus.accepted,
          provider: const BookingParty(id: 'p1', fullName: 'Kamal'),
        ),
      );
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);

      await c
          .read(bookingDetailProvider('a').notifier)
          .release('Running late.');

      final updated = c.read(bookingDetailProvider('a')).value!;
      expect(updated.status, BookingStatus.searching);
      expect(updated.provider, isNull);
    });

    test('cancel sets the cancellation details', () async {
      repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);

      await c
          .read(bookingDetailProvider('a').notifier)
          .cancel('Found someone else.');

      final updated = c.read(bookingDetailProvider('a')).value!;
      expect(updated.status, BookingStatus.cancelled);
      expect(updated.cancellation?.reason, 'Found someone else.');
    });

    test('submitQuote appends a quote', () async {
      repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);

      await c
          .read(bookingDetailProvider('a').notifier)
          .submitQuote(amount: 3000, note: 'Two hours of work.');

      final updated = c.read(bookingDetailProvider('a')).value!;
      expect(updated.quotes.single.amount, '3000.00');
      expect(updated.quotes.single.note, 'Two hours of work.');
    });

    test('acceptQuote assigns the quoted provider and price', () async {
      repo.bookings.add(
        bookingOf(
          id: 'a',
          status: BookingStatus.searching,
          quotes: [
            quoteOf(
              id: 'q1',
              amount: '4000.00',
              providerId: 'p1',
              providerName: 'Kamal',
            ),
          ],
        ),
      );
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);

      await c.read(bookingDetailProvider('a').notifier).acceptQuote('q1');

      final updated = c.read(bookingDetailProvider('a')).value!;
      expect(updated.status, BookingStatus.accepted);
      expect(updated.agreedAmount, '4000.00');
      expect(updated.provider?.id, 'p1');
    });

    test('rejectQuote marks that quote rejected without touching the booking status', () async {
      repo.bookings.add(
        bookingOf(
          id: 'a',
          status: BookingStatus.searching,
          quotes: [quoteOf(id: 'q1')],
        ),
      );
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);

      await c.read(bookingDetailProvider('a').notifier).rejectQuote('q1');

      final updated = c.read(bookingDetailProvider('a')).value!;
      expect(updated.status, BookingStatus.searching);
      expect(updated.quotes.single.status.name, 'rejected');
    });

    test('an action that fails leaves the loaded booking untouched', () async {
      repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
      keepAlive(bookingDetailProvider('a'));
      await c.read(bookingDetailProvider('a').future);
      repo.failures['accept'] = const ApiException(
        'x',
        statusCode: 409,
        code: 'INVALID_STATE',
      );

      await expectLater(
        c.read(bookingDetailProvider('a').notifier).accept(),
        throwsA(isA<AppException>()),
      );

      expect(
        c.read(bookingDetailProvider('a')).value!.status,
        BookingStatus.searching,
      );
      expect(c.read(bookingDetailProvider('a')).hasError, isFalse);
    });

    test(
      'an action updates the booking wherever else it is already loaded',
      () async {
        repo.bookings.add(bookingOf(id: 'a', status: BookingStatus.searching));
        keepAlive(myBookingsProvider);
        keepAlive(bookingDetailProvider('a'));
        await c.read(myBookingsProvider.future);
        await c.read(bookingDetailProvider('a').future);

        await c.read(bookingDetailProvider('a').notifier).cancel('x');

        expect(
          c.read(myBookingsProvider).value!.single.status,
          BookingStatus.cancelled,
        );
      },
    );
  });

  group('BookingHistoryTab', () {
    test('active covers every stage before completion', () {
      for (final status in [
        BookingStatus.searching,
        BookingStatus.accepted,
        BookingStatus.enRoute,
        BookingStatus.arrived,
        BookingStatus.inProgress,
      ]) {
        expect(
          BookingHistoryTab.active.matches(bookingOf(status: status)),
          isTrue,
          reason: status.name,
        );
        expect(
          BookingHistoryTab.past.matches(bookingOf(status: status)),
          isFalse,
        );
      }
    });

    test('past covers completed and cancelled', () {
      for (final status in [BookingStatus.completed, BookingStatus.cancelled]) {
        expect(
          BookingHistoryTab.past.matches(bookingOf(status: status)),
          isTrue,
        );
        expect(
          BookingHistoryTab.active.matches(bookingOf(status: status)),
          isFalse,
        );
      }
    });
  });
}
