import 'package:mobile/core/maps/map_point.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';

/// What the customer fills in to request a service.
class CreateBookingInput {
  const CreateBookingInput({
    required this.categorySlug,
    required this.citySlug,
    required this.bookingType,
    required this.serviceAddress,
    this.scheduledAt,
    this.customerNotes,
    this.serviceLocation,
  });

  final String categorySlug;
  final String citySlug;
  final BookingType bookingType;

  /// Required for [BookingType.scheduled], absent for [BookingType.onDemand].
  final DateTime? scheduledAt;
  final String serviceAddress;
  final String? customerNotes;

  /// Optional precise job location, used only as a matching input and for the
  /// map. Never required: booking works the same without it.
  final MapPoint? serviceLocation;
}

/// The booking lifecycle: creating a request, tracking it, and the actions
/// each side can take. Automatic matching runs server-side: a provider is
/// assigned by accepting a dispatch offer (directly, or by the customer
/// accepting their quote) — the client never chooses which provider gets
/// offered a booking. Live provider location, once a booking is under way, is
/// a separate realtime channel — see `features/tracking`.
///
/// Every method takes the language to answer in (`en`, `si` or `ta`): a
/// booking's category name is localized.
abstract interface class BookingRepository {
  Future<Booking> create(CreateBookingInput input, {required String language});

  Future<Booking> getBooking(String bookingId, {required String language});

  /// The signed-in customer's own bookings.
  Future<List<Booking>> listMine({
    required String language,
    BookingStatus? status,
  });

  /// The signed-in provider's assigned bookings.
  Future<List<Booking>> listAssigned({
    required String language,
    BookingStatus? status,
  });

  /// The signed-in provider's currently live dispatch offers: bookings
  /// automatic matching has offered them, not a browsable list of every open
  /// request.
  Future<List<Booking>> listOpen({required String language});

  // ---- provider actions ----------------------------------------------

  /// Directly accepts a held offer on a fixed/hourly request.
  Future<Booking> accept(String bookingId, {required String language});

  /// Turns down a held offer. Dispatch moves on to the next candidate.
  Future<Booking> decline(String bookingId, {required String language});

  Future<Booking> startEnRoute(String bookingId, {required String language});

  Future<Booking> markArrived(String bookingId, {required String language});

  Future<Booking> startWork(String bookingId, {required String language});

  Future<Booking> complete(String bookingId, {required String language});

  /// Backs out of an accepted job; the booking returns to open, not cancelled.
  Future<Booking> release(
    String bookingId,
    String reason, {
    required String language,
  });

  Future<Booking> submitQuote(
    String bookingId, {
    required double amount,
    required String language,
    String? note,
  });

  // ---- customer actions ------------------------------------------------

  Future<Booking> cancel(
    String bookingId,
    String reason, {
    required String language,
  });

  Future<Booking> acceptQuote(
    String bookingId,
    String quoteId, {
    required String language,
  });

  Future<Booking> rejectQuote(
    String bookingId,
    String quoteId, {
    required String language,
  });
}
