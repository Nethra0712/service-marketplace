import { eq, sql } from 'drizzle-orm';

import type { Queryable } from '../../db/client.js';
import {
  bookings,
  providerProfiles,
  reviews,
  type BookingStatus,
  type NewReview,
  type Review,
} from '../../db/schema/index.js';

/** What `submitReview`/`getForBooking` need to know about the booking being reviewed. */
export interface ReviewBookingContext {
  bookingId: string;
  status: BookingStatus;
  customerId: string;
  /** Null if no provider was ever assigned (e.g. still `searching`, or `expired`). */
  providerUserId: string | null;
}

export interface RatingSummary {
  averageRating: number | null;
  ratingCount: number;
}

/** All review data access. */
export function createReviewsRepository(db: Queryable) {
  return {
    async findBookingContext(bookingId: string): Promise<ReviewBookingContext | undefined> {
      const [row] = await db
        .select({
          bookingId: bookings.id,
          status: bookings.status,
          customerId: bookings.customerId,
          providerUserId: providerProfiles.userId,
        })
        .from(bookings)
        .leftJoin(providerProfiles, eq(providerProfiles.id, bookings.providerProfileId))
        .where(eq(bookings.id, bookingId));
      return row ? { ...row, providerUserId: row.providerUserId ?? null } : undefined;
    },

    async insert(values: NewReview): Promise<Review> {
      const [row] = await db.insert(reviews).values(values).returning();
      if (!row) throw new Error('Insert did not return a row.');
      return row;
    },

    /** At most two rows: one per participant. */
    async listForBooking(bookingId: string): Promise<Review[]> {
      return db.select().from(reviews).where(eq(reviews.bookingId, bookingId));
    },

    /**
     * Safe, server-computed only — see `reviews.ts`'s doc comment. Never
     * accepts a client-supplied aggregate. Keyed by the PUBLIC provider
     * profile id (what booking/catalogue views expose) rather than the
     * internal user id. Returns undefined if no such provider profile
     * exists at all, distinct from "exists but has no reviews yet" (a
     * summary with `ratingCount: 0`).
     */
    async getRatingSummaryForProviderProfile(
      providerProfileId: string,
    ): Promise<RatingSummary | undefined> {
      // Resolved separately from the aggregate below: an aggregate query has
      // no GROUP BY here, so it always returns exactly one row — even a
      // provider profile that does not exist would otherwise look
      // indistinguishable from one with zero reviews.
      const [profile] = await db
        .select({ userId: providerProfiles.userId })
        .from(providerProfiles)
        .where(eq(providerProfiles.id, providerProfileId));
      if (!profile) return undefined;

      const [row] = await db
        .select({
          averageRating: sql<string | null>`avg(${reviews.rating})`,
          ratingCount: sql<number>`count(*)::int`,
        })
        .from(reviews)
        .where(eq(reviews.targetUserId, profile.userId));
      return {
        averageRating: row?.averageRating == null ? null : Number(row.averageRating),
        ratingCount: row?.ratingCount ?? 0,
      };
    },
  };
}

export type ReviewsRepository = ReturnType<typeof createReviewsRepository>;
