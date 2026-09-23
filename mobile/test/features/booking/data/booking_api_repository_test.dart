import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/config/app_environment.dart';
import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/dio_factory.dart';
import 'package:mobile/features/booking/data/booking_api_repository.dart';
import 'package:mobile/features/booking/domain/booking_repository.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

import '../../../helpers/fake_http.dart';

const _config = AppConfig(
  environment: AppEnvironment.dev,
  apiBaseUrl: 'http://localhost:3000',
  enableNetworkLogging: false,
);

// Shaped exactly like the backend's booking responses.
const _bookingJson = {
  'id': '11111111-1111-4111-8111-111111111111',
  'status': 'searching',
  'bookingType': 'on_demand',
  'pricingModel': 'hourly',
  'category': {
    'id': '22222222-2222-4222-8222-222222222222',
    'slug': 'cleaning',
    'name': 'Cleaning',
  },
  'city': {'slug': 'colombo', 'name': 'Colombo'},
  'scheduledAt': null,
  'serviceAddress': '12 Galle Road',
  'customerNotes': null,
  'agreedAmount': null,
  'customer': {'id': 'user-1', 'fullName': 'Nimal Perera'},
  'provider': null,
  'timestamps': {
    'createdAt': '2026-01-01T09:00:00.000Z',
    'updatedAt': '2026-01-01T09:00:00.000Z',
    'acceptedAt': null,
    'enRouteAt': null,
    'arrivedAt': null,
    'workStartedAt': null,
    'completedAt': null,
  },
  'cancellation': null,
  'quotes': <Object>[],
};

(BookingApiRepository, FakeAdapter) _repo(
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  final adapter = FakeAdapter(handler);
  final dio = createDio(config: _config, readAccessToken: () async => 'tok')
    ..httpClientAdapter = adapter;
  return (BookingApiRepository(ApiClient(dio)), adapter);
}

void main() {
  group('create', () {
    test('sends every field and parses the created booking', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_bookingJson, status: 201),
      );

      final booking = await repo.create(
        const CreateBookingInput(
          categorySlug: 'cleaning',
          citySlug: 'colombo',
          bookingType: BookingType.onDemand,
          serviceAddress: '12 Galle Road',
        ),
        language: 'en',
      );

      expect(booking.id, _bookingJson['id']);
      expect(booking.status, BookingStatus.searching);
      expect(booking.pricingModel, PricingModel.hourly);
      expect(http.lastRequest!.method, 'POST');
      expect(http.lastRequest!.path, '/api/bookings');
      expect(http.lastRequest!.queryParameters, {'lang': 'en'});
      expect(http.lastRequest!.data, {
        'categorySlug': 'cleaning',
        'citySlug': 'colombo',
        'bookingType': 'on_demand',
        'scheduledAt': null,
        'serviceAddress': '12 Galle Road',
        'customerNotes': null,
      });
    });

    test('sends the scheduled time in UTC ISO-8601', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_bookingJson, status: 201),
      );
      final scheduledAt = DateTime.utc(2026, 3, 1, 14, 30);

      await repo.create(
        CreateBookingInput(
          categorySlug: 'plumbing',
          citySlug: 'colombo',
          bookingType: BookingType.scheduled,
          serviceAddress: '1 Test Road',
          scheduledAt: scheduledAt,
        ),
        language: 'en',
      );

      expect(http.lastRequest!.data['bookingType'], 'scheduled');
      expect(http.lastRequest!.data['scheduledAt'], '2026-03-01T14:30:00.000Z');
    });

    test('a blank note is sent as null, not an empty string', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_bookingJson, status: 201),
      );

      await repo.create(
        const CreateBookingInput(
          categorySlug: 'cleaning',
          citySlug: 'colombo',
          bookingType: BookingType.onDemand,
          serviceAddress: '1 Test Road',
          customerNotes: '   ',
        ),
        language: 'en',
      );

      expect(http.lastRequest!.data['customerNotes'], isNull);
    });

    test(
      'a category unavailable in that city is a NotFoundException',
      () async {
        final (repo, _) = _repo((_) async => errorBody(404, 'NOT_FOUND'));

        await expectLater(
          repo.create(
            const CreateBookingInput(
              categorySlug: 'painting',
              citySlug: 'colombo',
              bookingType: BookingType.onDemand,
              serviceAddress: '1 Test Road',
            ),
            language: 'en',
          ),
          throwsA(isA<NotFoundException>()),
        );
      },
    );
  });

  test(
    'getBooking parses cancellation, provider and quotes when present',
    () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({
          ..._bookingJson,
          'status': 'cancelled',
          'provider': {'id': 'provider-1', 'fullName': 'Kamal Silva'},
          'cancellation': {
            'at': '2026-01-01T12:00:00.000Z',
            'byUserId': 'user-1',
            'reason': 'Change of plans.',
          },
          'quotes': [
            {
              'id': 'quote-1',
              'status': 'accepted',
              'amount': '2500.00',
              'note': null,
              'provider': {'id': 'provider-1', 'fullName': 'Kamal Silva'},
              'createdAt': '2026-01-01T09:00:00.000Z',
              'respondedAt': '2026-01-01T10:00:00.000Z',
            },
          ],
        }),
      );

      final booking = await repo.getBooking(
        '11111111-1111-4111-8111-111111111111',
        language: 'en',
      );

      expect(booking.cancellation?.reason, 'Change of plans.');
      expect(booking.provider?.fullName, 'Kamal Silva');
      expect(booking.quotes.single.amount, '2500.00');
      expect(
        http.lastRequest!.path,
        '/api/bookings/11111111-1111-4111-8111-111111111111',
      );
    },
  );

  test('an unknown booking status is reported, not guessed', () async {
    final (repo, _) = _repo(
      (_) async => jsonBody({..._bookingJson, 'status': 'matched'}),
    );

    await expectLater(
      repo.getBooking('x', language: 'en'),
      throwsA(isA<UnknownException>()),
    );
  });

  group('listing', () {
    test('listMine sends the status filter only when given', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody({
          'items': [_bookingJson],
        }),
      );

      final withoutFilter = await repo.listMine(language: 'en');
      expect(withoutFilter, hasLength(1));
      expect(http.lastRequest!.queryParameters.containsKey('status'), isFalse);

      await repo.listMine(language: 'en', status: BookingStatus.enRoute);
      expect(http.lastRequest!.queryParameters['status'], 'en_route');
    });

    test('listAssigned and listOpen hit their own routes', () async {
      final (repo, http) = _repo((_) async => jsonBody({'items': <Object>[]}));

      await repo.listAssigned(language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/assigned');

      await repo.listOpen(language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/open');
    });
  });

  group('actions', () {
    test('each provider action posts to its own route', () async {
      final (repo, http) = _repo((_) async => jsonBody(_bookingJson));
      const id = '11111111-1111-4111-8111-111111111111';

      await repo.accept(id, language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/$id/accept');
      await repo.startEnRoute(id, language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/$id/en-route');
      await repo.markArrived(id, language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/$id/arrived');
      await repo.startWork(id, language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/$id/start');
      await repo.complete(id, language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/$id/complete');
    });

    test('release sends the trimmed reason', () async {
      final (repo, http) = _repo((_) async => jsonBody(_bookingJson));

      await repo.release('x', '  Vehicle broke down.  ', language: 'en');

      expect(http.lastRequest!.path, '/api/bookings/x/release');
      expect(http.lastRequest!.data, {'reason': 'Vehicle broke down.'});
    });

    test('cancel sends the trimmed reason', () async {
      final (repo, http) = _repo((_) async => jsonBody(_bookingJson));

      await repo.cancel('x', '  Changed my mind.  ', language: 'en');

      expect(http.lastRequest!.path, '/api/bookings/x/cancel');
      expect(http.lastRequest!.data, {'reason': 'Changed my mind.'});
    });

    test('a release/cancel not currently allowed is INVALID_STATE', () async {
      final (repo, _) = _repo((_) async => errorBody(409, 'INVALID_STATE'));

      await expectLater(
        repo.cancel('x', 'x', language: 'en'),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'INVALID_STATE'),
        ),
      );
    });

    test('submitQuote sends the amount and trimmed note', () async {
      final (repo, http) = _repo(
        (_) async => jsonBody(_bookingJson, status: 201),
      );

      await repo.submitQuote(
        'x',
        amount: 3500,
        note: '  Includes parts.  ',
        language: 'en',
      );

      expect(http.lastRequest!.path, '/api/bookings/x/quotes');
      expect(http.lastRequest!.data, {
        'amount': 3500,
        'note': 'Includes parts.',
      });
    });

    test('a duplicate quote is reported with its code', () async {
      final (repo, _) = _repo((_) async => errorBody(409, 'ALREADY_QUOTED'));

      await expectLater(
        repo.submitQuote('x', amount: 100, language: 'en'),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'ALREADY_QUOTED'),
        ),
      );
    });

    test('acceptQuote and rejectQuote hit the quote-scoped routes', () async {
      final (repo, http) = _repo((_) async => jsonBody(_bookingJson));

      await repo.acceptQuote('b', 'q', language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/b/quotes/q/accept');

      await repo.rejectQuote('b', 'q', language: 'en');
      expect(http.lastRequest!.path, '/api/bookings/b/quotes/q/reject');
    });
  });

  test('every request carries the bearer token', () async {
    final (repo, http) = _repo((_) async => jsonBody(_bookingJson));

    await repo.getBooking('x', language: 'en');

    expect(http.authorizations.single, 'Bearer tok');
  });
}
