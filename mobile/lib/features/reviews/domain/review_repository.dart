import 'package:mobile/features/reviews/domain/review.dart';

/// Review self-service for a completed booking's customer and its assigned
/// provider. There is no client-side rating aggregation here — every summary
/// figure comes back from the server (see `Review`'s doc comment).
abstract interface class ReviewRepository {
  /// Submits the caller's review of the booking's other participant.
  /// `comment` is trimmed and capped server-side; an empty string is treated
  /// the same as omitting it.
  Future<Review> submitReview(
    String bookingId, {
    required int rating,
    String? comment,
  });

  /// The caller's own review of this booking, and the other participant's,
  /// each null until submitted.
  Future<BookingReviews> getForBooking(String bookingId);
}
