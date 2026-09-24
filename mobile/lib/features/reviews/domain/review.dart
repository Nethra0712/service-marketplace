import 'package:mobile/core/network/json_helpers.dart';

/// One participant's rating of the other, for one completed booking. Ratings
/// and their aggregate are always server-computed (see `reviews.ts`'s doc
/// comment on the backend): this app never lets anyone submit an aggregate,
/// only their own single 1-5 rating.
class Review {
  const Review({
    required this.id,
    required this.bookingId,
    required this.rating,
    required this.comment,
    required this.isMine,
    required this.createdAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
    id: readString(json, 'id'),
    bookingId: readString(json, 'bookingId'),
    rating: readInt(json, 'rating'),
    comment: readStringOrNull(json, 'comment'),
    isMine: json['isMine'] == true,
    createdAt: DateTime.parse(readString(json, 'createdAt')),
  );

  final String id;
  final String bookingId;
  final int rating;
  final String? comment;
  final bool isMine;
  final DateTime createdAt;
}

/// A booking's reviews from the caller's point of view: their own (if
/// submitted) and the other participant's (if THEY have submitted one).
class BookingReviews {
  const BookingReviews({this.mine, this.theirs});

  factory BookingReviews.fromJson(Map<String, dynamic> json) {
    final mine = json['mine'];
    final theirs = json['theirs'];
    return BookingReviews(
      mine: mine is Map<String, dynamic> ? Review.fromJson(mine) : null,
      theirs: theirs is Map<String, dynamic> ? Review.fromJson(theirs) : null,
    );
  }

  final Review? mine;
  final Review? theirs;
}
