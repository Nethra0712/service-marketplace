import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/core/maps/map_point.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_repository.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/booking/domain/offer.dart';
import 'package:mobile/features/booking/domain/quote.dart';
import 'package:mobile/features/services/domain/pricing_model.dart';

/// Matches `testUser.id` in fakes.dart: the identity `AuthHarness` signs in
/// as by default, so a booking fixture's customer matches "me" out of the box.
const _defaultCustomerId = 'user-1';

/// A booking fixture, built the way a real server response would look, with
/// sensible defaults for whichever fields a test does not care about.
Booking bookingOf({
  String id = 'booking-1',
  BookingStatus status = BookingStatus.searching,
  BookingType bookingType = BookingType.onDemand,
  PricingModel pricingModel = PricingModel.hourly,
  String categorySlug = 'cleaning',
  String categoryName = 'Cleaning',
  String citySlug = 'colombo',
  String cityName = 'Colombo',
  String serviceAddress = '12 Galle Road, Colombo 03',
  String? customerNotes,
  String? agreedAmount,
  DateTime? scheduledAt,
  BookingParty customer = const BookingParty(
    id: _defaultCustomerId,
    fullName: 'Nimal Perera',
  ),
  BookingParty? provider,
  Cancellation? cancellation,
  Offer? myOffer,
  MapPoint? serviceLocation,
  List<Quote> quotes = const [],
  DateTime? acceptedAt,
  DateTime? enRouteAt,
  DateTime? arrivedAt,
  DateTime? workStartedAt,
  DateTime? completedAt,
}) => Booking(
  id: id,
  status: status,
  bookingType: bookingType,
  pricingModel: pricingModel,
  categoryId: 'id-$categorySlug',
  categorySlug: categorySlug,
  categoryName: categoryName,
  citySlug: citySlug,
  cityName: cityName,
  scheduledAt: scheduledAt,
  serviceAddress: serviceAddress,
  customerNotes: customerNotes,
  agreedAmount: agreedAmount,
  customer: customer,
  provider: provider,
  cancellation: cancellation,
  myOffer: myOffer,
  serviceLocation: serviceLocation,
  quotes: quotes,
  timestamps: BookingTimestamps(
    createdAt: DateTime.utc(2026, 1, 1, 9),
    updatedAt: DateTime.utc(2026, 1, 1, 9),
    acceptedAt: acceptedAt,
    enRouteAt: enRouteAt,
    arrivedAt: arrivedAt,
    workStartedAt: workStartedAt,
    completedAt: completedAt,
  ),
);

Offer offerOf({
  OfferStatus status = OfferStatus.pending,
  int wave = 1,
  DateTime? respondsBy,
  String? distanceKm,
}) => Offer(
  status: status,
  wave: wave,
  respondsBy: respondsBy ?? DateTime.utc(2026, 1, 1, 9, 1),
  distanceKm: distanceKm,
);

Quote quoteOf({
  String id = 'quote-1',
  QuoteStatus status = QuoteStatus.pending,
  String amount = '2500.00',
  String? note,
  String providerId = 'provider-profile-1',
  String? providerName = 'Kamal Silva',
  DateTime? respondedAt,
}) => Quote(
  id: id,
  status: status,
  amount: amount,
  note: note,
  providerId: providerId,
  providerName: providerName,
  createdAt: DateTime.utc(2026, 1, 1, 9),
  respondedAt: respondedAt,
);

/// An in-memory [BookingRepository]. Tests seed [bookings] directly (through
/// [bookingOf] fixtures) rather than relying on this fake to derive server
/// authorization: that state machine is already covered exhaustively by the
/// backend's own tests. This fake exists to drive realistic UI states and to
/// record what the app asked it to do.
class FakeBookingRepository implements BookingRepository {
  FakeBookingRepository({List<Booking>? bookings}) : bookings = [...?bookings];

  final List<Booking> bookings;

  /// Scripted failure for the next call to a method (by name), used once.
  final Map<String, AppException> failures = {};

  final createCalls = <CreateBookingInput>[];
  final languagesUsed = <String>[];
  var _idCounter = 0;

  void _maybeFail(String method) {
    final failure = failures.remove(method);
    if (failure != null) throw failure;
  }

  Booking _require(String bookingId) {
    for (final booking in bookings) {
      if (booking.id == bookingId) return booking;
    }
    throw const NotFoundException('Booking not found.');
  }

  void _replace(Booking updated) {
    final index = bookings.indexWhere((b) => b.id == updated.id);
    if (index == -1) {
      bookings.add(updated);
    } else {
      bookings[index] = updated;
    }
  }

  @override
  Future<Booking> create(
    CreateBookingInput input, {
    required String language,
  }) async {
    createCalls.add(input);
    languagesUsed.add(language);
    _maybeFail('create');
    _idCounter += 1;
    final created = bookingOf(
      id: 'booking-$_idCounter',
      status: BookingStatus.searching,
      bookingType: input.bookingType,
      categorySlug: input.categorySlug,
      categoryName: input.categorySlug,
      citySlug: input.citySlug,
      cityName: input.citySlug,
      serviceAddress: input.serviceAddress,
      customerNotes: input.customerNotes,
      scheduledAt: input.scheduledAt,
      serviceLocation: input.serviceLocation,
    );
    bookings.add(created);
    return created;
  }

  @override
  Future<Booking> getBooking(
    String bookingId, {
    required String language,
  }) async {
    languagesUsed.add(language);
    _maybeFail('getBooking');
    return _require(bookingId);
  }

  @override
  Future<List<Booking>> listMine({
    required String language,
    BookingStatus? status,
  }) async {
    languagesUsed.add(language);
    _maybeFail('listMine');
    return [
      for (final b in bookings)
        if (status == null || b.status == status) b,
    ];
  }

  @override
  Future<List<Booking>> listAssigned({
    required String language,
    BookingStatus? status,
  }) async {
    languagesUsed.add(language);
    _maybeFail('listAssigned');
    return [
      for (final b in bookings)
        if (b.provider != null && (status == null || b.status == status)) b,
    ];
  }

  @override
  Future<List<Booking>> listOpen({required String language}) async {
    languagesUsed.add(language);
    _maybeFail('listOpen');
    return [
      for (final b in bookings)
        if (b.status == BookingStatus.searching) b,
    ];
  }

  @override
  Future<Booking> accept(String bookingId, {required String language}) async {
    _maybeFail('accept');
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: BookingStatus.accepted,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      provider: const BookingParty(
        id: 'provider-profile-1',
        fullName: 'Kamal Silva',
      ),
      acceptedAt: DateTime.utc(2026, 1, 1, 10),
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> decline(String bookingId, {required String language}) async {
    _maybeFail('decline');
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: current.status,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      quotes: current.quotes,
      myOffer: current.myOffer == null
          ? null
          : Offer(
              status: OfferStatus.declined,
              wave: current.myOffer!.wave,
              respondsBy: current.myOffer!.respondsBy,
              distanceKm: current.myOffer!.distanceKm,
            ),
    );
    _replace(updated);
    return updated;
  }

  Future<Booking> _stage(
    String bookingId,
    BookingStatus status, {
    DateTime? acceptedAt,
    DateTime? enRouteAt,
    DateTime? arrivedAt,
    DateTime? workStartedAt,
    DateTime? completedAt,
  }) async {
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: status,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      agreedAmount: current.agreedAmount,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      provider: current.provider,
      quotes: current.quotes,
      acceptedAt: acceptedAt ?? current.timestamps.acceptedAt,
      enRouteAt: enRouteAt ?? current.timestamps.enRouteAt,
      arrivedAt: arrivedAt ?? current.timestamps.arrivedAt,
      workStartedAt: workStartedAt ?? current.timestamps.workStartedAt,
      completedAt: completedAt ?? current.timestamps.completedAt,
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> startEnRoute(
    String bookingId, {
    required String language,
  }) async {
    _maybeFail('startEnRoute');
    return _stage(
      bookingId,
      BookingStatus.enRoute,
      enRouteAt: DateTime.utc(2026, 1, 1, 10, 5),
    );
  }

  @override
  Future<Booking> markArrived(
    String bookingId, {
    required String language,
  }) async {
    _maybeFail('markArrived');
    return _stage(
      bookingId,
      BookingStatus.arrived,
      arrivedAt: DateTime.utc(2026, 1, 1, 10, 20),
    );
  }

  @override
  Future<Booking> startWork(
    String bookingId, {
    required String language,
  }) async {
    _maybeFail('startWork');
    return _stage(
      bookingId,
      BookingStatus.inProgress,
      workStartedAt: DateTime.utc(2026, 1, 1, 10, 25),
    );
  }

  @override
  Future<Booking> complete(String bookingId, {required String language}) async {
    _maybeFail('complete');
    return _stage(
      bookingId,
      BookingStatus.completed,
      completedAt: DateTime.utc(2026, 1, 1, 11),
    );
  }

  @override
  Future<Booking> release(
    String bookingId,
    String reason, {
    required String language,
  }) async {
    _maybeFail('release');
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: BookingStatus.searching,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      quotes: current.quotes,
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> submitQuote(
    String bookingId, {
    required double amount,
    required String language,
    String? note,
  }) async {
    _maybeFail('submitQuote');
    final current = _require(bookingId);
    final quote = quoteOf(
      id: 'quote-${current.id}',
      amount: amount.toStringAsFixed(2),
      note: note,
    );
    final updated = bookingOf(
      id: current.id,
      status: current.status,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      quotes: [...current.quotes, quote],
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> cancel(
    String bookingId,
    String reason, {
    required String language,
  }) async {
    _maybeFail('cancel');
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: BookingStatus.cancelled,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      provider: current.provider,
      quotes: current.quotes,
      acceptedAt: current.timestamps.acceptedAt,
      cancellation: Cancellation(
        at: DateTime.utc(2026, 1, 1, 12),
        byUserId: current.customer.id,
        reason: reason,
      ),
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> acceptQuote(
    String bookingId,
    String quoteId, {
    required String language,
  }) async {
    _maybeFail('acceptQuote');
    final current = _require(bookingId);
    final accepted = current.quotes.firstWhere((q) => q.id == quoteId);
    final updated = bookingOf(
      id: current.id,
      status: BookingStatus.accepted,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      provider: BookingParty(
        id: accepted.providerId,
        fullName: accepted.providerName,
      ),
      agreedAmount: accepted.amount,
      acceptedAt: DateTime.utc(2026, 1, 1, 10),
      quotes: [
        for (final q in current.quotes)
          if (q.id == quoteId)
            Quote(
              id: q.id,
              status: QuoteStatus.accepted,
              amount: q.amount,
              note: q.note,
              providerId: q.providerId,
              providerName: q.providerName,
              createdAt: q.createdAt,
              respondedAt: DateTime.utc(2026, 1, 1, 10),
            )
          else
            Quote(
              id: q.id,
              status: QuoteStatus.rejected,
              amount: q.amount,
              note: q.note,
              providerId: q.providerId,
              providerName: q.providerName,
              createdAt: q.createdAt,
              respondedAt: DateTime.utc(2026, 1, 1, 10),
            ),
      ],
    );
    _replace(updated);
    return updated;
  }

  @override
  Future<Booking> rejectQuote(
    String bookingId,
    String quoteId, {
    required String language,
  }) async {
    _maybeFail('rejectQuote');
    final current = _require(bookingId);
    final updated = bookingOf(
      id: current.id,
      status: current.status,
      bookingType: current.bookingType,
      pricingModel: current.pricingModel,
      categorySlug: current.categorySlug,
      categoryName: current.categoryName,
      citySlug: current.citySlug,
      cityName: current.cityName,
      serviceAddress: current.serviceAddress,
      customerNotes: current.customerNotes,
      scheduledAt: current.scheduledAt,
      customer: current.customer,
      quotes: [
        for (final q in current.quotes)
          if (q.id == quoteId)
            Quote(
              id: q.id,
              status: QuoteStatus.rejected,
              amount: q.amount,
              note: q.note,
              providerId: q.providerId,
              providerName: q.providerName,
              createdAt: q.createdAt,
              respondedAt: DateTime.utc(2026, 1, 1, 10),
            )
          else
            q,
      ],
    );
    _replace(updated);
    return updated;
  }
}
