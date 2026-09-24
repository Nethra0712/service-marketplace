import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reviews/domain/review.dart';

void main() {
  group('Review.fromJson', () {
    test('parses a review with a comment', () {
      final review = Review.fromJson({
        'id': 'r1',
        'bookingId': 'b1',
        'rating': 5,
        'comment': 'Great work!',
        'isMine': true,
        'createdAt': '2026-01-01T12:00:00.000Z',
      });

      expect(review.rating, 5);
      expect(review.comment, 'Great work!');
      expect(review.isMine, isTrue);
    });

    test('parses a review with no comment', () {
      final review = Review.fromJson({
        'id': 'r1',
        'bookingId': 'b1',
        'rating': 3,
        'comment': null,
        'isMine': false,
        'createdAt': '2026-01-01T12:00:00.000Z',
      });

      expect(review.comment, isNull);
      expect(review.isMine, isFalse);
    });
  });

  group('BookingReviews.fromJson', () {
    test('parses both sides present', () {
      final reviews = BookingReviews.fromJson({
        'mine': {
          'id': 'r1',
          'bookingId': 'b1',
          'rating': 5,
          'comment': null,
          'isMine': true,
          'createdAt': '2026-01-01T12:00:00.000Z',
        },
        'theirs': {
          'id': 'r2',
          'bookingId': 'b1',
          'rating': 4,
          'comment': null,
          'isMine': false,
          'createdAt': '2026-01-01T12:00:00.000Z',
        },
      });

      expect(reviews.mine?.rating, 5);
      expect(reviews.theirs?.rating, 4);
    });

    test('parses neither side present as both null', () {
      final reviews = BookingReviews.fromJson({'mine': null, 'theirs': null});
      expect(reviews.mine, isNull);
      expect(reviews.theirs, isNull);
    });
  });
}
