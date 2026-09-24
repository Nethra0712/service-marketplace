import 'package:mobile/core/errors/app_exception.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/domain/review_repository.dart';

Review reviewOf({
  String id = 'review-1',
  String bookingId = 'b1',
  int rating = 5,
  String? comment = 'Great work!',
  bool isMine = true,
}) => Review(
  id: id,
  bookingId: bookingId,
  rating: rating,
  comment: comment,
  isMine: isMine,
  createdAt: DateTime.utc(2026, 1, 1, 12),
);

/// An in-memory [ReviewRepository]. Tests seed [reviews] keyed by booking id.
class FakeReviewRepository implements ReviewRepository {
  final Map<String, BookingReviews> reviews = {};
  final submitted = <String>[];

  final Map<String, AppException> failures = {};
  void _maybeFail(String method) {
    final failure = failures.remove(method);
    if (failure != null) throw failure;
  }

  @override
  Future<Review> submitReview(
    String bookingId, {
    required int rating,
    String? comment,
  }) async {
    submitted.add(bookingId);
    _maybeFail('submitReview');
    final review = reviewOf(
      bookingId: bookingId,
      rating: rating,
      comment: comment,
    );
    final existing = reviews[bookingId];
    reviews[bookingId] = BookingReviews(mine: review, theirs: existing?.theirs);
    return review;
  }

  @override
  Future<BookingReviews> getForBooking(String bookingId) async {
    _maybeFail('getForBooking');
    return reviews[bookingId] ?? const BookingReviews();
  }
}
