import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app/l10n/app_localizations.dart';
import 'package:mobile/app/theme/app_spacing.dart';
import 'package:mobile/core/errors/error_message.dart';
import 'package:mobile/features/booking/domain/booking.dart';
import 'package:mobile/features/booking/domain/booking_status.dart';
import 'package:mobile/features/reviews/application/review_providers.dart';
import 'package:mobile/features/reviews/domain/review.dart';
import 'package:mobile/features/reviews/presentation/star_rating.dart';

/// Reviews for a completed booking, shown on its detail screen. Shows the
/// caller's own review (or a form to submit one) and the other
/// participant's, if they have submitted theirs. There is nothing to show
/// before the booking is `completed` — a booking cannot be reviewed any
/// earlier (see `reviews.service.ts`).
class ReviewSection extends ConsumerWidget {
  const ReviewSection({required this.booking, super.key});

  final Booking booking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (booking.status != BookingStatus.completed) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    final reviewsState = ref.watch(bookingReviewsProvider(booking.id));

    return Card(
      child: Padding(
        padding: AppSpacing.screen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.reviewSectionTitle, style: textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            reviewsState.when(
              skipLoadingOnReload: true,
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text(
                errorMessage(l10n, error),
                key: const Key('review_error'),
              ),
              data: (reviews) =>
                  _ReviewsBody(bookingId: booking.id, reviews: reviews),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewsBody extends StatelessWidget {
  const _ReviewsBody({required this.bookingId, required this.reviews});

  final String bookingId;
  final BookingReviews reviews;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final mine = reviews.mine;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (mine != null)
          _ReviewDisplay(title: l10n.reviewYourReview, review: mine)
        else
          _ReviewForm(bookingId: bookingId),
        if (reviews.theirs case final theirs?) ...[
          const SizedBox(height: AppSpacing.md),
          _ReviewDisplay(title: l10n.reviewCounterpartReview, review: theirs),
        ],
      ],
    );
  }
}

class _ReviewDisplay extends StatelessWidget {
  const _ReviewDisplay({required this.title, required this.review});

  final String title;
  final Review review;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final textTheme = Theme.of(context).textTheme;
    return Column(
      key: Key('review_${review.id}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: textTheme.labelMedium),
        const SizedBox(height: AppSpacing.xs),
        StarRating(rating: review.rating),
        const SizedBox(height: AppSpacing.xs),
        Text(review.comment ?? l10n.reviewNoComment),
      ],
    );
  }
}

class _ReviewForm extends ConsumerStatefulWidget {
  const _ReviewForm({required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<_ReviewForm> createState() => _ReviewFormState();
}

class _ReviewFormState extends ConsumerState<_ReviewForm> {
  int _rating = 0;
  final _commentController = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) return;
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final comment = _commentController.text.trim();
      await ref
          .read(bookingReviewsProvider(widget.bookingId).notifier)
          .submit(rating: _rating, comment: comment.isEmpty ? null : comment);
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(l10n.reviewSubmitted)));
    } on Object catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(errorMessage(l10n, error))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.reviewRatingLabel),
        const SizedBox(height: AppSpacing.xs),
        StarRating(
          key: const Key('review_rating_input'),
          rating: _rating,
          interactive: true,
          onChanged: (value) => setState(() => _rating = value),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          key: const Key('review_comment_field'),
          controller: _commentController,
          minLines: 2,
          maxLines: 4,
          maxLength: 1000,
          decoration: InputDecoration(
            labelText: l10n.reviewCommentLabel,
            hintText: l10n.reviewCommentHint,
            border: const OutlineInputBorder(),
          ),
        ),
        FilledButton(
          key: const Key('submit_review_button'),
          onPressed: _busy || _rating == 0 ? null : () => _submit(),
          child: Text(l10n.reviewSubmit),
        ),
      ],
    );
  }
}
