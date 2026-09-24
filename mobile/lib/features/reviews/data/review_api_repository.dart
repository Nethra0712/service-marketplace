import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/domain/review_repository.dart';

/// [ReviewRepository] backed by the platform API.
class ReviewApiRepository implements ReviewRepository {
  ReviewApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<Review> submitReview(
    String bookingId, {
    required int rating,
    String? comment,
  }) async {
    final data = await _api.post(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/review',
      data: {'rating': rating, if (comment != null) 'comment': comment},
    );
    return parseResponse(() => Review.fromJson(asJsonObject(data)));
  }

  @override
  Future<BookingReviews> getForBooking(String bookingId) async {
    final data = await _api.get(
      '/api/bookings/${Uri.encodeComponent(bookingId)}/reviews',
    );
    return parseResponse(() => BookingReviews.fromJson(asJsonObject(data)));
  }
}
