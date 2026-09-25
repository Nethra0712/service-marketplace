import { and, asc, count, desc, eq, gt, inArray, lte, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Queryable } from '../../db/client.js';
import {
  bookingOffers,
  bookingProviderReleases,
  bookingQuotes,
  bookings,
  cities,
  profiles,
  providerProfiles,
  serviceCategories,
  serviceCategoryTranslations,
  type AppLanguage,
  type BookingOfferStatus,
  type BookingQuoteStatus,
  type BookingStatus,
  type BookingType,
  type NewBooking,
  type PricingModel,
} from '../../db/schema/index.js';

/** The full, view-ready shape of a booking, joined with what it references. */
export interface BookingRow {
  id: string;
  status: BookingStatus;
  bookingType: BookingType;
  pricingModel: PricingModel;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  cityId: string;
  citySlug: string;
  cityName: string;
  scheduledAt: Date | null;
  serviceAddress: string;
  customerNotes: string | null;
  customerLatitude: string | null;
  customerLongitude: string | null;
  matchingExpiresAt: Date | null;
  agreedAmount: string | null;
  customerId: string;
  customerName: string | null;
  providerProfileId: string | null;
  providerName: string | null;
  acceptedAt: Date | null;
  enRouteAt: Date | null;
  arrivedAt: Date | null;
  workStartedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The minimum needed to authorize and guard a transition, without the joins. */
export interface BookingCore {
  id: string;
  status: BookingStatus;
  customerId: string;
  providerProfileId: string | null;
  serviceCategoryId: string;
  cityId: string;
  pricingModel: PricingModel;
  customerLatitude: string | null;
  customerLongitude: string | null;
  matchingExpiresAt: Date | null;
  agreedAmount: string | null;
  workStartedAt: Date | null;
  /** The category's LKR rate (per job or per hour), for `fixed`/`hourly` pricing. Null for `quote`. */
  baseRate: string | null;
}

export interface QuoteRow {
  id: string;
  bookingId: string;
  status: BookingQuoteStatus;
  amount: string;
  note: string | null;
  providerProfileId: string;
  providerName: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface QuoteCore {
  id: string;
  bookingId: string;
  providerProfileId: string;
  status: BookingQuoteStatus;
  amount: string;
}

/** A dispatch offer's shape as attached to a booking view, or listed for a provider. */
export interface OfferSummary {
  status: BookingOfferStatus;
  wave: number;
  respondsBy: Date;
  distanceKm: string | null;
}

/** Statuses a provider may still release the job from (before work starts). */
export const RELEASABLE_STATUSES: readonly BookingStatus[] = ['accepted', 'en_route', 'arrived'];

/** Statuses a customer may still cancel from. */
export const CANCELLABLE_STATUSES: readonly BookingStatus[] = ['searching', ...RELEASABLE_STATUSES];

/**
 * All booking data access. Takes a `Queryable` so a service can run several
 * calls on one transaction (see `releaseAssignment` and `acceptQuote`, which
 * are only ever safe to call together with their companion writes).
 */
export function createBookingsRepository(db: Queryable) {
  const customerProfile = alias(profiles, 'customer_profile');
  const providerAccountProfile = alias(profiles, 'provider_account_profile');
  const localizedCategoryName = sql<string>`coalesce(${serviceCategoryTranslations.name}, ${serviceCategories.name})`;

  function selectBookings(language: AppLanguage) {
    return db
      .select({
        id: bookings.id,
        status: bookings.status,
        bookingType: bookings.bookingType,
        pricingModel: bookings.pricingModel,
        categoryId: bookings.serviceCategoryId,
        categorySlug: serviceCategories.slug,
        categoryName: localizedCategoryName,
        cityId: cities.id,
        citySlug: cities.slug,
        cityName: cities.name,
        scheduledAt: bookings.scheduledAt,
        serviceAddress: bookings.serviceAddress,
        customerNotes: bookings.customerNotes,
        customerLatitude: bookings.customerLatitude,
        customerLongitude: bookings.customerLongitude,
        matchingExpiresAt: bookings.matchingExpiresAt,
        agreedAmount: bookings.agreedAmount,
        customerId: bookings.customerId,
        customerName: customerProfile.fullName,
        providerProfileId: bookings.providerProfileId,
        providerName: providerAccountProfile.fullName,
        acceptedAt: bookings.acceptedAt,
        enRouteAt: bookings.enRouteAt,
        arrivedAt: bookings.arrivedAt,
        workStartedAt: bookings.workStartedAt,
        completedAt: bookings.completedAt,
        cancelledAt: bookings.cancelledAt,
        cancelledByUserId: bookings.cancelledByUserId,
        cancellationReason: bookings.cancellationReason,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .innerJoin(serviceCategories, eq(serviceCategories.id, bookings.serviceCategoryId))
      .leftJoin(
        serviceCategoryTranslations,
        and(
          eq(serviceCategoryTranslations.serviceCategoryId, serviceCategories.id),
          eq(serviceCategoryTranslations.language, language),
        ),
      )
      .innerJoin(cities, eq(cities.id, bookings.cityId))
      .leftJoin(customerProfile, eq(customerProfile.userId, bookings.customerId))
      .leftJoin(providerProfiles, eq(providerProfiles.id, bookings.providerProfileId))
      .leftJoin(providerAccountProfile, eq(providerAccountProfile.userId, providerProfiles.userId));
  }

  function selectQuotes() {
    return db
      .select({
        id: bookingQuotes.id,
        bookingId: bookingQuotes.bookingId,
        status: bookingQuotes.status,
        amount: bookingQuotes.amount,
        note: bookingQuotes.note,
        providerProfileId: bookingQuotes.providerProfileId,
        providerName: profiles.fullName,
        createdAt: bookingQuotes.createdAt,
        respondedAt: bookingQuotes.respondedAt,
      })
      .from(bookingQuotes)
      .innerJoin(providerProfiles, eq(providerProfiles.id, bookingQuotes.providerProfileId))
      .leftJoin(profiles, eq(profiles.userId, providerProfiles.userId));
  }

  return {
    // ---- reads -----------------------------------------------------------

    async insert(values: NewBooking): Promise<{ id: string }> {
      const [row] = await db.insert(bookings).values(values).returning({ id: bookings.id });
      if (!row) throw new Error('Booking insert returned no row');
      return row;
    },

    async findById(id: string, language: AppLanguage): Promise<BookingRow | undefined> {
      const [row] = await selectBookings(language).where(eq(bookings.id, id));
      return row;
    },

    /** Lean lookup for authorization and transition guards. Joins only `service_categories`, for `baseRate`. */
    async findCore(id: string): Promise<BookingCore | undefined> {
      const [row] = await db
        .select({
          id: bookings.id,
          status: bookings.status,
          customerId: bookings.customerId,
          providerProfileId: bookings.providerProfileId,
          serviceCategoryId: bookings.serviceCategoryId,
          cityId: bookings.cityId,
          pricingModel: bookings.pricingModel,
          customerLatitude: bookings.customerLatitude,
          customerLongitude: bookings.customerLongitude,
          matchingExpiresAt: bookings.matchingExpiresAt,
          agreedAmount: bookings.agreedAmount,
          workStartedAt: bookings.workStartedAt,
          baseRate: serviceCategories.baseRate,
        })
        .from(bookings)
        .innerJoin(serviceCategories, eq(serviceCategories.id, bookings.serviceCategoryId))
        .where(eq(bookings.id, id));
      return row;
    },

    async listForCustomer(
      customerId: string,
      language: AppLanguage,
      status?: BookingStatus,
    ): Promise<BookingRow[]> {
      return selectBookings(language)
        .where(
          and(
            eq(bookings.customerId, customerId),
            status ? eq(bookings.status, status) : undefined,
          ),
        )
        .orderBy(desc(bookings.createdAt), asc(bookings.id));
    },

    async listForProvider(
      providerProfileId: string,
      language: AppLanguage,
      status?: BookingStatus,
    ): Promise<BookingRow[]> {
      return selectBookings(language)
        .where(
          and(
            eq(bookings.providerProfileId, providerProfileId),
            status ? eq(bookings.status, status) : undefined,
          ),
        )
        .orderBy(desc(bookings.createdAt), asc(bookings.id));
    },

    // ---- provider assignment ----------------------------------------------

    /**
     * searching (unassigned, non-quote) -> accepted. `agreedAmount` is set
     * here for `fixed` pricing (the category's flat rate); left untouched
     * (still null) for `hourly`, whose amount is only knowable once the work
     * is actually done — see `complete`.
     */
    async acceptDirect(
      bookingId: string,
      providerProfileId: string,
      now: Date,
      agreedAmount: string | null,
    ): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({
          status: 'accepted',
          providerProfileId,
          acceptedAt: now,
          ...(agreedAmount !== null ? { agreedAmount } : {}),
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, 'searching'),
            ne(bookings.pricingModel, 'quote'),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /** accepted -> en_route, scoped to the assigned provider. */
    async startEnRoute(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'en_route', enRouteAt: now })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.providerProfileId, providerProfileId),
            eq(bookings.status, 'accepted'),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /** en_route -> arrived, scoped to the assigned provider. */
    async markArrived(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'arrived', arrivedAt: now })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.providerProfileId, providerProfileId),
            eq(bookings.status, 'en_route'),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /** arrived -> in_progress, scoped to the assigned provider. */
    async startWork(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'in_progress', workStartedAt: now })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.providerProfileId, providerProfileId),
            eq(bookings.status, 'arrived'),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /**
     * in_progress -> completed, scoped to the assigned provider.
     * `agreedAmount` is set here for `hourly` pricing (rate * hours worked,
     * computed by the service); left untouched for `fixed`/`quote`, which
     * already have it from `acceptDirect`/`acceptQuoteOnBooking`.
     */
    async complete(
      bookingId: string,
      providerProfileId: string,
      now: Date,
      agreedAmount: string | null,
    ): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({
          status: 'completed',
          completedAt: now,
          ...(agreedAmount !== null ? { agreedAmount } : {}),
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.providerProfileId, providerProfileId),
            eq(bookings.status, 'in_progress'),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /**
     * accepted/en_route/arrived -> searching (unassigns). The release record
     * itself is a separate insert; callers run both inside one transaction.
     */
    async releaseAssignment(bookingId: string, providerProfileId: string): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({
          status: 'searching',
          providerProfileId: null,
          acceptedAt: null,
          enRouteAt: null,
          arrivedAt: null,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.providerProfileId, providerProfileId),
            inArray(bookings.status, RELEASABLE_STATUSES),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    /**
     * Clears the releasing provider's own offer out of `accepted` (it would
     * otherwise permanently block the `booking_offers_booking_accepted_uidx`
     * guarantee, since a booking they no longer hold is about to be won by
     * someone else). `superseded` fits: it is no longer live for reasons
     * other than the provider's own answer.
     */
    async supersedeAcceptedOffer(
      bookingId: string,
      providerProfileId: string,
      now: Date,
    ): Promise<void> {
      await db
        .update(bookingOffers)
        .set({ status: 'superseded', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            eq(bookingOffers.providerProfileId, providerProfileId),
            eq(bookingOffers.status, 'accepted'),
          ),
        );
    },

    async insertProviderRelease(
      bookingId: string,
      providerProfileId: string,
      reason: string | null,
      releasedAt: Date,
    ): Promise<void> {
      await db
        .insert(bookingProviderReleases)
        .values({ bookingId, providerProfileId, reason, releasedAt });
    },

    /** searching -> expired: matching gave up (no offer was ever accepted in time). */
    async expireBooking(bookingId: string): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'expired' })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'searching')))
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    // ---- dispatch offers ---------------------------------------------------

    /** The highest wave number offered so far for this booking, or 0 if none yet. */
    async maxOfferWave(bookingId: string): Promise<number> {
      const [row] = await db
        .select({ maxWave: sql<number | null>`max(${bookingOffers.wave})` })
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, bookingId));
      return row?.maxWave ?? 0;
    },

    /** Creates one wave of offers. A no-op if there is nobody to offer to. */
    async insertOfferWave(
      bookingId: string,
      wave: number,
      candidates: readonly { providerProfileId: string; distanceKm: number | null }[],
      offeredAt: Date,
      respondsBy: Date,
    ): Promise<void> {
      if (candidates.length === 0) return;
      // `onConflictDoNothing` with no target applies to any unique
      // constraint on the table (both `booking_offers_booking_provider_wave_uidx`
      // and `..._pending_uidx`), and — critically for a multi-row insert —
      // Postgres skips only the individual rows that collide, not the whole
      // batch. A plain insert would instead fail the entire statement on a
      // partial collision (some candidates new, one already offered by a
      // concurrent dispatch for this booking), silently dropping the
      // legitimately-new candidates along with it. See `dispatchWave`'s own
      // caller, which can race with itself across concurrent requests.
      await db
        .insert(bookingOffers)
        .values(
          candidates.map((c) => ({
            bookingId,
            providerProfileId: c.providerProfileId,
            wave,
            offeredAt,
            respondsBy,
            distanceKm: c.distanceKm === null ? null : c.distanceKm.toFixed(2),
          })),
        )
        .onConflictDoNothing();
    },

    /**
     * pending -> accepted, only if still within its response window. This is
     * the row that decides who wins the booking: only one provider's update
     * can match (the unique index on `(booking_id) where status = 'accepted'`
     * backs this up even against a same-instant race), so callers run this
     * before touching the booking itself, inside the same transaction.
     */
    async consumeOfferForAccept(
      bookingId: string,
      providerProfileId: string,
      now: Date,
    ): Promise<boolean> {
      const updated = await db
        .update(bookingOffers)
        .set({ status: 'accepted', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            eq(bookingOffers.providerProfileId, providerProfileId),
            eq(bookingOffers.status, 'pending'),
            gt(bookingOffers.respondsBy, now),
          ),
        )
        .returning({ id: bookingOffers.id });
      return updated.length === 1;
    },

    /** pending -> declined, scoped to the offered provider. */
    async declineOffer(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookingOffers)
        .set({ status: 'declined', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            eq(bookingOffers.providerProfileId, providerProfileId),
            eq(bookingOffers.status, 'pending'),
          ),
        )
        .returning({ id: bookingOffers.id });
      return updated.length === 1;
    },

    /** Every other still-pending offer on this booking loses once one is accepted. */
    async supersedeOtherPendingOffers(
      bookingId: string,
      exceptProviderProfileId: string,
      now: Date,
    ): Promise<void> {
      await db
        .update(bookingOffers)
        .set({ status: 'superseded', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            ne(bookingOffers.providerProfileId, exceptProviderProfileId),
            eq(bookingOffers.status, 'pending'),
          ),
        );
    },

    /** Every pending offer on this booking loses, e.g. because the customer cancelled it. */
    async supersedeAllPendingOffers(bookingId: string, now: Date): Promise<void> {
      await db
        .update(bookingOffers)
        .set({ status: 'superseded', respondedAt: now })
        .where(and(eq(bookingOffers.bookingId, bookingId), eq(bookingOffers.status, 'pending')));
    },

    /** Lazily settles offers nobody answered in time. Called before every wave decision. */
    async expireDueOffers(bookingId: string, now: Date): Promise<void> {
      await db
        .update(bookingOffers)
        .set({ status: 'expired', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            eq(bookingOffers.status, 'pending'),
            lte(bookingOffers.respondsBy, now),
          ),
        );
    },

    /** How many still-live offers this booking currently has out. Call {@link expireDueOffers} first. */
    async countPendingOffers(bookingId: string): Promise<number> {
      const [row] = await db
        .select({ total: count() })
        .from(bookingOffers)
        .where(and(eq(bookingOffers.bookingId, bookingId), eq(bookingOffers.status, 'pending')));
      return row?.total ?? 0;
    },

    /**
     * Everyone who must not be offered this booking in the next wave: anyone
     * with a live or resolved-non-favourably offer on it already (pending —
     * would duplicate; accepted — already won; declined — said no; expired —
     * had their chance and did not answer), plus anyone who accepted and
     * later released it. Deliberately NOT anyone whose offer was merely
     * `superseded`: they never actually got a fair answer window (someone
     * else won the race first), so they stay eligible for a later wave —
     * e.g. once the booking is re-dispatched after a release. Excluding
     * `expired` here (unlike the other statuses) is what makes "expand the
     * search" actually reach new candidates instead of re-asking whoever
     * ranked highest and simply didn't answer in time.
     */
    async listExcludedProviderIds(bookingId: string): Promise<string[]> {
      const [offered, released] = await Promise.all([
        db
          .select({ id: bookingOffers.providerProfileId })
          .from(bookingOffers)
          .where(
            and(
              eq(bookingOffers.bookingId, bookingId),
              inArray(bookingOffers.status, ['pending', 'accepted', 'declined', 'expired']),
            ),
          ),
        db
          .select({ id: bookingProviderReleases.providerProfileId })
          .from(bookingProviderReleases)
          .where(eq(bookingProviderReleases.bookingId, bookingId)),
      ]);
      return [...new Set([...offered.map((r) => r.id), ...released.map((r) => r.id)])];
    },

    /** This provider's most recent offer on this booking, whatever it currently is (view authorization). */
    async findOfferForProvider(
      bookingId: string,
      providerProfileId: string,
    ): Promise<OfferSummary | undefined> {
      const [row] = await db
        .select({
          status: bookingOffers.status,
          wave: bookingOffers.wave,
          respondsBy: bookingOffers.respondsBy,
          distanceKm: bookingOffers.distanceKm,
        })
        .from(bookingOffers)
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            eq(bookingOffers.providerProfileId, providerProfileId),
          ),
        )
        .orderBy(desc(bookingOffers.wave))
        .limit(1);
      return row;
    },

    /** This provider's currently live offers (booking + offer detail), most urgent first. */
    async listMyOffers(
      providerProfileId: string,
      language: AppLanguage,
      now: Date,
    ): Promise<{ booking: BookingRow; offer: OfferSummary }[]> {
      const offers = await db
        .select({
          bookingId: bookingOffers.bookingId,
          status: bookingOffers.status,
          wave: bookingOffers.wave,
          respondsBy: bookingOffers.respondsBy,
          distanceKm: bookingOffers.distanceKm,
        })
        .from(bookingOffers)
        .where(
          and(
            eq(bookingOffers.providerProfileId, providerProfileId),
            eq(bookingOffers.status, 'pending'),
            gt(bookingOffers.respondsBy, now),
          ),
        )
        .orderBy(asc(bookingOffers.respondsBy));
      if (offers.length === 0) return [];

      const rows = await selectBookings(language).where(
        inArray(
          bookings.id,
          offers.map((o) => o.bookingId),
        ),
      );
      const byId = new Map(rows.map((r) => [r.id, r]));

      const result: { booking: BookingRow; offer: OfferSummary }[] = [];
      for (const o of offers) {
        const booking = byId.get(o.bookingId);
        if (!booking) continue; // Vanishingly unlikely (booking deleted mid-request); skip rather than crash.
        result.push({
          booking,
          offer: {
            status: o.status,
            wave: o.wave,
            respondsBy: o.respondsBy,
            distanceKm: o.distanceKm,
          },
        });
      }
      return result;
    },

    // ---- customer cancellation --------------------------------------------

    /** searching/accepted/en_route/arrived -> cancelled, scoped to the customer. */
    async cancelByCustomer(
      bookingId: string,
      customerId: string,
      reason: string,
      now: Date,
    ): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelledByUserId: customerId,
          cancellationReason: reason,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.customerId, customerId),
            inArray(bookings.status, CANCELLABLE_STATUSES),
          ),
        )
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    // ---- quotes -------------------------------------------------------------

    async insertQuote(
      bookingId: string,
      providerProfileId: string,
      amount: string,
      note: string | null,
    ): Promise<{ id: string }> {
      const [row] = await db
        .insert(bookingQuotes)
        .values({ bookingId, providerProfileId, amount, note })
        .returning({ id: bookingQuotes.id });
      if (!row) throw new Error('Quote insert returned no row');
      return row;
    },

    async listQuotesForBooking(bookingId: string): Promise<QuoteRow[]> {
      return selectQuotes()
        .where(eq(bookingQuotes.bookingId, bookingId))
        .orderBy(desc(bookingQuotes.createdAt));
    },

    /** Every quote this provider has made on this booking, current and past, newest first. */
    async listMyQuotes(bookingId: string, providerProfileId: string): Promise<QuoteRow[]> {
      return selectQuotes()
        .where(
          and(
            eq(bookingQuotes.bookingId, bookingId),
            eq(bookingQuotes.providerProfileId, providerProfileId),
          ),
        )
        .orderBy(desc(bookingQuotes.createdAt));
    },

    async findQuoteCore(quoteId: string): Promise<QuoteCore | undefined> {
      const [row] = await db
        .select({
          id: bookingQuotes.id,
          bookingId: bookingQuotes.bookingId,
          providerProfileId: bookingQuotes.providerProfileId,
          status: bookingQuotes.status,
          amount: bookingQuotes.amount,
        })
        .from(bookingQuotes)
        .where(eq(bookingQuotes.id, quoteId));
      return row;
    },

    /** Assigns the quoted provider and price to the booking. searching -> accepted. */
    async acceptQuoteOnBooking(
      bookingId: string,
      providerProfileId: string,
      amount: string,
      now: Date,
    ): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'accepted', providerProfileId, agreedAmount: amount, acceptedAt: now })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'searching')))
        .returning({ id: bookings.id });
      return updated.length === 1;
    },

    async markQuoteAccepted(quoteId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookingQuotes)
        .set({ status: 'accepted', respondedAt: now })
        .where(and(eq(bookingQuotes.id, quoteId), eq(bookingQuotes.status, 'pending')))
        .returning({ id: bookingQuotes.id });
      return updated.length === 1;
    },

    async rejectOtherPendingQuotes(
      bookingId: string,
      exceptQuoteId: string,
      now: Date,
    ): Promise<void> {
      await db
        .update(bookingQuotes)
        .set({ status: 'rejected', respondedAt: now })
        .where(
          and(
            eq(bookingQuotes.bookingId, bookingId),
            ne(bookingQuotes.id, exceptQuoteId),
            eq(bookingQuotes.status, 'pending'),
          ),
        );
    },

    async rejectQuote(quoteId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookingQuotes)
        .set({ status: 'rejected', respondedAt: now })
        .where(and(eq(bookingQuotes.id, quoteId), eq(bookingQuotes.status, 'pending')))
        .returning({ id: bookingQuotes.id });
      return updated.length === 1;
    },
  };
}

export type BookingsRepository = ReturnType<typeof createBookingsRepository>;
