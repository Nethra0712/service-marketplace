import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Queryable } from '../../db/client.js';
import {
  bookingProviderReleases,
  bookingQuotes,
  bookings,
  cities,
  profiles,
  providerProfiles,
  serviceCategories,
  serviceCategoryTranslations,
  type AppLanguage,
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

export interface CategoryCityPair {
  serviceCategoryId: string;
  cityId: string;
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

    /** Lean lookup for authorization and transition guards; no joins. */
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
        })
        .from(bookings)
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

    /** Open (`searching`) bookings across any of the given category/city pairs. */
    async listOpen(pairs: CategoryCityPair[], language: AppLanguage): Promise<BookingRow[]> {
      if (pairs.length === 0) return [];
      return selectBookings(language)
        .where(
          and(
            eq(bookings.status, 'searching'),
            or(
              ...pairs.map((pair) =>
                and(
                  eq(bookings.serviceCategoryId, pair.serviceCategoryId),
                  eq(bookings.cityId, pair.cityId),
                ),
              ),
            ),
          ),
        )
        .orderBy(asc(bookings.createdAt));
    },

    // ---- provider assignment ----------------------------------------------

    /** searching (unassigned, non-quote) -> accepted. */
    async acceptDirect(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'accepted', providerProfileId, acceptedAt: now })
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

    /** in_progress -> completed, scoped to the assigned provider. */
    async complete(bookingId: string, providerProfileId: string, now: Date): Promise<boolean> {
      const updated = await db
        .update(bookings)
        .set({ status: 'completed', completedAt: now })
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
