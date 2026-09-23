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
  });

  final String categorySlug;
  final String citySlug;
  final BookingType bookingType;

  /// Required for [BookingType.scheduled], absent for [BookingType.onDemand].
  final DateTime? scheduledAt;
  final String serviceAddress;
  final String? customerNotes;
}

/// The booking lifecycle: creating a request, tracking it, and the actions
/// each side can take. There is deliberately no automatic matching here (a
/// provider is assigned by directly accepting an open request, or by the
/// customer accepting their quote) and no live location.
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

  /// Open requests the signed-in provider could accept or quote on.
  Future<List<Booking>> listOpen({required String language});

  // ---- provider actions ----------------------------------------------

  /// Directly accepts an open fixed/hourly request.
  Future<Booking> accept(String bookingId, {required String language});

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
