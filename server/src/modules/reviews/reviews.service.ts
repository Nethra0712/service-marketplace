import type { Database } from '../../db/client.js';
import type { Review } from '../../db/schema/index.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { blankToNull } from '../../lib/text.js';
import { createReviewsRepository, type RatingSummary } from './reviews.repository.js';

export interface ReviewView {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  isMine: boolean;
  createdAt: string;
}

export interface SubmitReviewInput {
  rating: number;
  comment?: string | null | undefined;
}

export interface ReviewsServiceDeps {
  db: Database;
}

const MAX_COMMENT_LENGTH = 1000;

const notFound = (message: string) => new AppError(404, ErrorCode.NotFound, message);
const notParticipant = () =>
  new AppError(403, ErrorCode.NotBookingParticipant, 'You are not a participant in this booking.');
const notCompleted = () =>
  new AppError(409, ErrorCode.BookingNotCompleted, 'Only a completed booking can be reviewed.');
const noCounterpart = () =>
  new AppError(
    409,
    ErrorCode.BookingNotCompleted,
    'This booking has no other participant to review.',
  );
const alreadyReviewed = () =>
  new AppError(409, ErrorCode.AlreadyReviewed, 'You have already reviewed this booking.');

const toView = (row: Review, viewerUserId: string): ReviewView => ({
  id: row.id,
  bookingId: row.bookingId,
  rating: row.rating,
  comment: row.comment,
  isMine: row.authorUserId === viewerUserId,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Two-sided, post-completion reviews: a booking's customer and its assigned
 * provider may each rate the other once. `authorUserId`/`targetUserId` are
 * derived entirely from the booking and the caller's own identity — never
 * from client input — so nobody can review a booking they were not part of,
 * review themselves, or submit a rating for someone else. See `reviews.ts`'s
 * doc comment for the database guarantees (one review per participant per
 * booking, rating range, no self-review) this service relies on rather than
 * re-checking by hand.
 */
export function createReviewsService({ db }: ReviewsServiceDeps) {
  const repository = createReviewsRepository(db);

  /** Resolves the caller's role on `bookingId` and who they may review. Throws if they are not a participant. */
  async function resolveParticipant(userId: string, bookingId: string) {
    const context = await repository.findBookingContext(bookingId);
    if (!context) throw notFound('Booking not found.');

    const isCustomer = context.customerId === userId;
    const isProvider = context.providerUserId === userId;
    if (!isCustomer && !isProvider) throw notParticipant();

    const targetUserId = isCustomer ? context.providerUserId : context.customerId;
    return { context, targetUserId };
  }

  return {
    async submitReview(
      authorUserId: string,
      bookingId: string,
      input: SubmitReviewInput,
    ): Promise<ReviewView> {
      const { context, targetUserId } = await resolveParticipant(authorUserId, bookingId);
      if (context.status !== 'completed') throw notCompleted();
      if (!targetUserId) throw noCounterpart();

      const comment = blankToNull(input.comment?.trim().slice(0, MAX_COMMENT_LENGTH));

      try {
        const row = await repository.insert({
          bookingId,
          authorUserId,
          targetUserId,
          rating: input.rating,
          comment,
        });
        return toView(row, authorUserId);
      } catch (error) {
        if (isUniqueViolation(error, 'reviews_booking_author_uidx')) throw alreadyReviewed();
        throw error;
      }
    },

    /** The caller's own review of this booking, and the counterpart's, if either exists. */
    async getForBooking(
      viewerUserId: string,
      bookingId: string,
    ): Promise<{ mine: ReviewView | null; theirs: ReviewView | null }> {
      await resolveParticipant(viewerUserId, bookingId);
      const rows = await repository.listForBooking(bookingId);
      const mine = rows.find((row) => row.authorUserId === viewerUserId);
      const theirs = rows.find((row) => row.authorUserId !== viewerUserId);
      return {
        mine: mine ? toView(mine, viewerUserId) : null,
        theirs: theirs ? toView(theirs, viewerUserId) : null,
      };
    },

    /** A provider's aggregate rating, purely computed — see `reviews.ts`'s doc comment. */
    async getProviderRatingSummary(providerProfileId: string): Promise<RatingSummary> {
      const summary = await repository.getRatingSummaryForProviderProfile(providerProfileId);
      if (!summary) throw notFound('Provider not found.');
      return summary;
    },
  };
}

export type ReviewsService = ReturnType<typeof createReviewsService>;
