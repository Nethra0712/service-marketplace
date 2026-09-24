import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_repository.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';

/// [BookingRepository] backed by the platform API. Takes the authenticated
/// client: every one of these routes requires a signed-in user.
class BookingApiRepository implements BookingRepository {
  BookingApiRepository(this._api);

  final ApiClient _api;

  Booking _booking(Object? data) =>
      parseResponse(() => Booking.fromJson(asJsonObject(data)));

  List<Booking> _bookings(Object? data) => parseResponse(
    () => readObjects(
      asJsonObject(data),
      'items',
    ).map(Booking.fromJson).toList(growable: false),
  );

  @override
  Future<Booking> create(
    CreateBookingInput input, {
    required String language,
  }) async {
    final notes = input.customerNotes?.trim();
    final point = input.serviceLocation;
    final data = await _api.post(
      '/api/bookings',
      queryParameters: {'lang': language},
      data: {
        'categorySlug': input.categorySlug,
        'citySlug': input.citySlug,
        'bookingType': input.bookingType.wireValue,
        'scheduledAt': input.scheduledAt?.toUtc().toIso8601String(),
        'serviceAddress': input.serviceAddress.trim(),
        'customerNotes': notes == null || notes.isEmpty ? null : notes,
        if (point != null) 'latitude': point.latitude,
        if (point != null) 'longitude': point.longitude,
      },
    );
    return _booking(data);
  }

  @override
  Future<Booking> getBooking(
    String bookingId, {
    required String language,
  }) async {
    final data = await _api.get(
      '/api/bookings/${Uri.encodeComponent(bookingId)}',
      queryParameters: {'lang': language},
    );
    return _booking(data);
  }

  @override
  Future<List<Booking>> listMine({
    required String language,
    BookingStatus? status,
  }) async {
    final data = await _api.get(
      '/api/bookings/mine',
      queryParameters: {'lang': language, 'status': ?status?.wireValue},
    );
    return _bookings(data);
  }

  @override
  Future<List<Booking>> listAssigned({
    required String language,
    BookingStatus? status,
  }) async {
    final data = await _api.get(
      '/api/bookings/assigned',
      queryParameters: {'lang': language, 'status': ?status?.wireValue},
    );
    return _bookings(data);
  }

  @override
  Future<List<Booking>> listOpen({required String language}) async {
    final data = await _api.get(
      '/api/bookings/open',
      queryParameters: {'lang': language},
    );
    return _bookings(data);
  }

  Future<Booking> _action(String path, {required String language}) async {
    final data = await _api.post(path, queryParameters: {'lang': language});
    return _booking(data);
  }

  @override
  Future<Booking> accept(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/accept',
        language: language,
      );

  @override
  Future<Booking> decline(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/decline',
        language: language,
      );

  @override
  Future<Booking> startEnRoute(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/en-route',
        language: language,
      );

  @override
  Future<Booking> markArrived(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/arrived',
        language: language,
      );

  @override
  Future<Booking> startWork(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/start',
        language: language,
      );

  @override
  Future<Booking> complete(String bookingId, {required String language}) =>
      _action(
        '/api/bookings/${Uri.encodeComponent(bookingId)}/complete',
        language: language,
      );

  @override
  Future<Booking> release(
    String bookingId,
    String reason, {
    required String language,
  }) async {
    final data = await _api.post(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/release',
      queryParameters: {'lang': language},
      data: {'reason': reason.trim()},
    );
    return _booking(data);
  }

  @override
  Future<Booking> submitQuote(
    String bookingId, {
    required double amount,
    required String language,
    String? note,
  }) async {
    final trimmedNote = note?.trim();
    final data = await _api.post(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/quotes',
      queryParameters: {'lang': language},
      data: {
        'amount': amount,
        'note': trimmedNote == null || trimmedNote.isEmpty ? null : trimmedNote,
      },
    );
    return _booking(data);
  }

  @override
  Future<Booking> cancel(
    String bookingId,
    String reason, {
    required String language,
  }) async {
    final data = await _api.post(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/cancel',
      queryParameters: {'lang': language},
      data: {'reason': reason.trim()},
    );
    return _booking(data);
  }

  @override
  Future<Booking> acceptQuote(
    String bookingId,
    String quoteId, {
    required String language,
  }) => _action(
    '/api/bookings/${Uri.encodeComponent(bookingId)}/quotes/${Uri.encodeComponent(quoteId)}/accept',
    language: language,
  );

  @override
  Future<Booking> rejectQuote(
    String bookingId,
    String quoteId, {
    required String language,
  }) => _action(
    '/api/bookings/${Uri.encodeComponent(bookingId)}/quotes/${Uri.encodeComponent(quoteId)}/reject',
    language: language,
  );
}
