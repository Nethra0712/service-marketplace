import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Queryable } from '../../db/client.js';
import {
  bookings,
  profiles,
  providerProfiles,
  reviews,
  type BookingStatus,
  type NewReview,
  type Review,
} from '../../db/schema/index.js';

// Two independent joins to `profiles`, one per side of a review (author and target).
const authorProfile = alias(profiles, 'author_profile');
const targetProfile = alias(profiles, 'target_profile');

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

/** One review, with enough context for an admin list — never for a participant-facing view. */
export interface AdminReviewRow {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  authorUserId: string;
  authorName: string | null;
  targetUserId: string;
  targetName: string | null;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  createdAt: Date;
}

export interface AdminReviewFilter {
  /** Matches either participant's name. */
  search?: string | undefined;
  hidden?: boolean | undefined;
  limit: number;
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
        // Hidden reviews never count toward the public aggregate — see
        // `reviews.ts`'s doc comment on `hiddenAt`.
        .where(and(eq(reviews.targetUserId, profile.userId), isNull(reviews.hiddenAt)));
      return {
        averageRating: row?.averageRating == null ? null : Number(row.averageRating),
        ratingCount: row?.ratingCount ?? 0,
      };
    },

    // ---- admin ---------------------------------------------------------

    async listForAdmin(filter: AdminReviewFilter): Promise<AdminReviewRow[]> {
      const conditions = [
        filter.hidden === undefined
          ? undefined
          : filter.hidden
            ? isNotNull(reviews.hiddenAt)
            : isNull(reviews.hiddenAt),
        filter.search
          ? or(
              ilike(authorProfile.fullName, `%${filter.search}%`),
              ilike(targetProfile.fullName, `%${filter.search}%`),
            )
          : undefined,
      ].filter((c) => c !== undefined);

      const rows = await db
        .select({
          id: reviews.id,
          bookingId: reviews.bookingId,
          rating: reviews.rating,
          comment: reviews.comment,
          authorUserId: reviews.authorUserId,
          authorName: authorProfile.fullName,
          targetUserId: reviews.targetUserId,
          targetName: targetProfile.fullName,
          hiddenAt: reviews.hiddenAt,
          hiddenReason: reviews.hiddenReason,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .leftJoin(authorProfile, eq(authorProfile.userId, reviews.authorUserId))
        .leftJoin(targetProfile, eq(targetProfile.userId, reviews.targetUserId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(reviews.createdAt))
        .limit(filter.limit);
      return rows;
    },

    async findById(id: string): Promise<Review | undefined> {
      const [row] = await db.select().from(reviews).where(eq(reviews.id, id));
      return row;
    },

    /** `undefined` if already hidden or the review does not exist — idempotency is the caller's job. */
    async hide(
      id: string,
      adminUserId: string,
      reason: string | null,
      now: Date,
    ): Promise<Review | undefined> {
      const [row] = await db
        .update(reviews)
        .set({ hiddenAt: now, hiddenByAdminId: adminUserId, hiddenReason: reason })
        .where(and(eq(reviews.id, id), isNull(reviews.hiddenAt)))
        .returning();
      return row;
    },
  };
}

export type ReviewsRepository = ReturnType<typeof createReviewsRepository>;
