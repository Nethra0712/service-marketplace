import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/network_providers.dart';
import 'package:mobile/core/utils/provider_retry.dart';
import 'package:mobile/features/auth/application/auth_status_provider.dart';
import 'package:mobile/features/reviews/data/review_api_repository.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/domain/review_repository.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>(
  (ref) => ReviewApiRepository(ref.watch(apiClientProvider)),
);

void _watchAccount(Ref ref) => ref.watch(authStatusProvider);

/// One booking's reviews, for its customer or assigned provider.
class BookingReviewsController extends AsyncNotifier<BookingReviews> {
  BookingReviewsController(this.bookingId);

  final String bookingId;

  @override
  Future<BookingReviews> build() {
    _watchAccount(ref);
    return ref.watch(reviewRepositoryProvider).getForBooking(bookingId);
  }

  Future<void> submit({required int rating, String? comment}) async {
    await ref
        .read(reviewRepositoryProvider)
        .submitReview(bookingId, rating: rating, comment: comment);
    ref.invalidateSelf();
    await future;
  }
}

final bookingReviewsProvider = AsyncNotifierProvider.autoDispose
    .family<BookingReviewsController, BookingReviews, String>(
      BookingReviewsController.new,
      retry: noAutomaticRetry,
    );
