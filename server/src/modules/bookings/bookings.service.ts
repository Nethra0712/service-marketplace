import type {
  AppLanguage,
  BookingQuoteStatus,
  BookingStatus,
  BookingType,
  PricingModel,
} from '../../db/schema/index.js';
import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { blankToNull } from '../../lib/text.js';
import {
  createBookingsRepository,
  RELEASABLE_STATUSES,
  CANCELLABLE_STATUSES,
  type BookingCore,
  type BookingRow,
  type QuoteRow,
} from './bookings.repository.js';

export interface QuoteView {
  id: string;
  status: BookingQuoteStatus;
  amount: string;
  note: string | null;
  provider: { id: string; fullName: string | null };
  createdAt: string;
  respondedAt: string | null;
}

export interface BookingSummaryView {
  id: string;
  status: BookingStatus;
  bookingType: BookingType;
  pricingModel: PricingModel;
  category: { id: string; slug: string; name: string };
  city: { slug: string; name: string };
  scheduledAt: string | null;
  serviceAddress: string;
  customerNotes: string | null;
  agreedAmount: string | null;
  customer: { id: string; fullName: string | null };
  provider: { id: string; fullName: string | null } | null;
  timestamps: {
    createdAt: string;
    updatedAt: string;
    acceptedAt: string | null;
    enRouteAt: string | null;
    arrivedAt: string | null;
    workStartedAt: string | null;
    completedAt: string | null;
  };
  cancellation: { at: string; byUserId: string; reason: string | null } | null;
}

/**
 * A booking's full detail. `quotes` is always present for a quote-priced
 * booking but its CONTENTS depend on the viewer: the customer sees every
 * quote, a provider sees only their own (never a competitor's price).
 */
export interface BookingDetailView extends BookingSummaryView {
  quotes: QuoteView[];
}

export interface CreateBookingInput {
  categorySlug: string;
  citySlug: string;
  bookingType: BookingType;
  /** ISO datetime string; required for `scheduled`, absent for `on_demand`. */
  scheduledAt?: string | undefined;
  serviceAddress: string;
  customerNotes?: string | null | undefined;
}

export interface SubmitQuoteInput {
  amount: number;
  note?: string | null | undefined;
}

/** Resolves a category/city pair to book against. Supplied by the catalogue module. */
export type OfferedCategoryLookup = (
  categorySlug: string,
  citySlug: string,
) => Promise<{ serviceCategoryId: string; cityId: string; pricingModel: PricingModel } | undefined>;

/** The caller's provider profile id, if they have one. Supplied by the providers module. */
export type ProviderProfileLookup = (userId: string) => Promise<string | undefined>;

/** Approved + verified + active, for this category and city. Supplied by the providers module. */
export type EligibilityCheck = (
  providerProfileId: string,
  offering: { serviceCategoryId: string; cityId: string },
) => Promise<boolean>;

/** Every category/city the given provider is currently eligible for. Supplied by the providers module. */
export type EligibleOfferingsLookup = (
  providerProfileId: string,
) => Promise<{ serviceCategoryId: string; cityId: string }[]>;

export interface BookingsServiceDeps {
  db: Database;
  clock: Clock;
  findOfferedCategory: OfferedCategoryLookup;
  findProviderProfileId: ProviderProfileLookup;
  isBookable: EligibilityCheck;
  listEligibleOfferings: EligibleOfferingsLookup;
}

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const toSummaryView = (row: BookingRow): BookingSummaryView => ({
  id: row.id,
  status: row.status,
  bookingType: row.bookingType,
  pricingModel: row.pricingModel,
  category: { id: row.categoryId, slug: row.categorySlug, name: row.categoryName },
  city: { slug: row.citySlug, name: row.cityName },
  scheduledAt: iso(row.scheduledAt),
  serviceAddress: row.serviceAddress,
  customerNotes: row.customerNotes,
  agreedAmount: row.agreedAmount,
  customer: { id: row.customerId, fullName: row.customerName },
  provider:
    row.providerProfileId === null
      ? null
      : { id: row.providerProfileId, fullName: row.providerName },
  timestamps: {
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acceptedAt: iso(row.acceptedAt),
    enRouteAt: iso(row.enRouteAt),
    arrivedAt: iso(row.arrivedAt),
    workStartedAt: iso(row.workStartedAt),
    completedAt: iso(row.completedAt),
  },
  cancellation:
    row.cancelledAt === null || row.cancelledByUserId === null
      ? null
      : {
          at: row.cancelledAt.toISOString(),
          byUserId: row.cancelledByUserId,
          reason: row.cancellationReason,
        },
});

const toQuoteView = (row: QuoteRow): QuoteView => ({
  id: row.id,
  status: row.status,
  amount: row.amount,
  note: row.note,
  provider: { id: row.providerProfileId, fullName: row.providerName },
  createdAt: row.createdAt.toISOString(),
  respondedAt: iso(row.respondedAt),
});

const notFound = (message: string) => new AppError(404, ErrorCode.NotFound, message);
const invalidState = (message: string) => new AppError(409, ErrorCode.InvalidState, message);
const profileRequired = () =>
  new AppError(
    409,
    ErrorCode.ProviderProfileRequired,
    'Create your provider profile before doing that.',
  );
const profileNotFound = () =>
  new AppError(404, ErrorCode.ProviderProfileNotFound, 'You have no provider profile yet.');
const notEligible = () =>
  new AppError(
    403,
    ErrorCode.ProviderNotEligible,
    'You are not approved for this service in this city.',
  );

/**
 * Booking self-service for customers and providers. Every method authorizes
 * against the caller (never a supplied id), and every state change goes
 * through a guarded conditional update so a lost race becomes a clean 409
 * instead of a corrupted booking. No automatic matching: a provider is
 * assigned either by directly accepting an open fixed/hourly request or by
 * the customer accepting their quote.
 */
export function createBookingsService({
  db,
  clock,
  findOfferedCategory,
  findProviderProfileId,
  isBookable,
  listEligibleOfferings,
}: BookingsServiceDeps) {
  const repository = createBookingsRepository(db);

  /** For write actions: a missing profile is something to fix (409), not a 404. */
  async function requireProviderProfileId(userId: string): Promise<string> {
    const id = await findProviderProfileId(userId);
    if (!id) throw profileRequired();
    return id;
  }

  /** Any authenticated caller may look this up to build the right error; it never authorizes access. */
  async function requireCore(bookingId: string): Promise<BookingCore> {
    const core = await repository.findCore(bookingId);
    if (!core) throw notFound('Booking not found.');
    return core;
  }

  /** Like {@link requireCore}, but a booking that fails `owns` looks exactly like a missing one. */
  async function requireOwnCore(
    bookingId: string,
    owns: (core: BookingCore) => boolean,
  ): Promise<BookingCore> {
    const core = await repository.findCore(bookingId);
    if (!core || !owns(core)) throw notFound('Booking not found.');
    return core;
  }

  /**
   * Loads a booking for whoever is allowed to see it: its customer, or its
   * assigned provider, a provider who has quoted on it (so they can see how
   * their quote was decided even once it is no longer open), or a provider
   * currently eligible to accept or quote it while it is still open (so they
   * can view its detail before deciding). Anyone else gets the same 404 a
   * missing booking would (existence is not revealed to the wrong person).
   * Quotes are attached per the viewer's role, never both sides' at once.
   */
  async function loadForViewer(
    bookingId: string,
    userId: string,
    language: AppLanguage,
  ): Promise<BookingDetailView> {
    const row = await repository.findById(bookingId, language);
    if (!row) throw notFound('Booking not found.');

    const isCustomer = row.customerId === userId;
    const callerProviderProfileId = await findProviderProfileId(userId);
    const isAssignedProvider =
      row.providerProfileId !== null && row.providerProfileId === callerProviderProfileId;

    let myQuotes: QuoteRow[] = [];
    let canView = isCustomer || isAssignedProvider;
    if (!canView && callerProviderProfileId) {
      myQuotes = await repository.listMyQuotes(bookingId, callerProviderProfileId);
      canView = myQuotes.length > 0;
      if (!canView && row.status === 'searching') {
        canView = await isBookable(callerProviderProfileId, {
          serviceCategoryId: row.categoryId,
          cityId: row.cityId,
        });
      }
    }
    if (!canView) throw notFound('Booking not found.');

    let quotes: QuoteView[] = [];
    if (row.pricingModel === 'quote') {
      if (isCustomer) {
        quotes = (await repository.listQuotesForBooking(bookingId)).map(toQuoteView);
      } else {
        quotes = myQuotes.map(toQuoteView);
      }
    }
    return { ...toSummaryView(row), quotes };
  }

  /** Shared shape for the four single-step provider actions (en-route, arrived, start, complete). */
  async function providerTransition(
    userId: string,
    bookingId: string,
    language: AppLanguage,
    fromStatus: BookingStatus,
    run: (providerProfileId: string, now: Date) => Promise<boolean>,
  ): Promise<BookingDetailView> {
    const providerProfileId = await requireProviderProfileId(userId);
    const core = await requireOwnCore(bookingId, (c) => c.providerProfileId === providerProfileId);
    if (core.status !== fromStatus) {
      throw invalidState(`This booking cannot be moved from "${core.status}" that way.`);
    }
    if (!(await run(providerProfileId, clock()))) {
      throw invalidState(`This booking cannot be moved from "${core.status}" that way.`);
    }
    return loadForViewer(bookingId, userId, language);
  }

  return {
    async create(
      customerId: string,
      input: CreateBookingInput,
      language: AppLanguage,
    ): Promise<BookingDetailView> {
      const offered = await findOfferedCategory(input.categorySlug, input.citySlug);
      if (!offered) throw notFound('That service is not available in this city.');

      const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      if (scheduledAt !== null && scheduledAt.getTime() <= clock().getTime()) {
        throw new AppError(
          400,
          ErrorCode.ValidationError,
          'Scheduled time must be in the future.',
          {
            details: [{ path: 'scheduledAt', message: 'Must be in the future.' }],
          },
        );
      }

      const { id } = await repository.insert({
        customerId,
        serviceCategoryId: offered.serviceCategoryId,
        cityId: offered.cityId,
        bookingType: input.bookingType,
        pricingModel: offered.pricingModel,
        scheduledAt,
        customerNotes: blankToNull(input.customerNotes),
        serviceAddress: input.serviceAddress.trim(),
      });
      return loadForViewer(id, customerId, language);
    },

    async getForViewer(
      userId: string,
      bookingId: string,
      language: AppLanguage,
    ): Promise<BookingDetailView> {
      return loadForViewer(bookingId, userId, language);
    },

    async listForCustomer(customerId: string, language: AppLanguage, status?: BookingStatus) {
      return (await repository.listForCustomer(customerId, language, status)).map(toSummaryView);
    },

    /** The caller's own assigned bookings. A missing profile is a 404: this is a read, not an application. */
    async listForProvider(userId: string, language: AppLanguage, status?: BookingStatus) {
      const providerProfileId = await findProviderProfileId(userId);
      if (!providerProfileId) throw profileNotFound();
      return (await repository.listForProvider(providerProfileId, language, status)).map(
        toSummaryView,
      );
    },

    /** Open requests across every category/city the caller is currently approved and verified for. */
    async listOpenForProvider(userId: string, language: AppLanguage) {
      const providerProfileId = await findProviderProfileId(userId);
      if (!providerProfileId) throw profileNotFound();
      const offerings = await listEligibleOfferings(providerProfileId);
      return (await repository.listOpen(offerings, language)).map(toSummaryView);
    },

    /** A provider directly accepts an open fixed/hourly request. Quote-priced bookings must go through a quote. */
    async accept(userId: string, bookingId: string, language: AppLanguage) {
      const providerProfileId = await requireProviderProfileId(userId);
      const core = await requireCore(bookingId);

      if (core.pricingModel === 'quote') {
        throw new AppError(
          409,
          ErrorCode.QuoteNotApplicable,
          'This service is quote-based: submit a quote instead of accepting directly.',
        );
      }
      if (core.status !== 'searching' || core.providerProfileId !== null) {
        throw invalidState('This booking has already been taken.');
      }
      if (!(await isBookable(providerProfileId, core))) throw notEligible();

      if (!(await repository.acceptDirect(bookingId, providerProfileId, clock()))) {
        throw invalidState('This booking has already been taken.');
      }
      return loadForViewer(bookingId, userId, language);
    },

    async startEnRoute(userId: string, bookingId: string, language: AppLanguage) {
      return providerTransition(userId, bookingId, language, 'accepted', (providerId, now) =>
        repository.startEnRoute(bookingId, providerId, now),
      );
    },

    async markArrived(userId: string, bookingId: string, language: AppLanguage) {
      return providerTransition(userId, bookingId, language, 'en_route', (providerId, now) =>
        repository.markArrived(bookingId, providerId, now),
      );
    },

    async startWork(userId: string, bookingId: string, language: AppLanguage) {
      return providerTransition(userId, bookingId, language, 'arrived', (providerId, now) =>
        repository.startWork(bookingId, providerId, now),
      );
    },

    async complete(userId: string, bookingId: string, language: AppLanguage) {
      return providerTransition(userId, bookingId, language, 'in_progress', (providerId, now) =>
        repository.complete(bookingId, providerId, now),
      );
    },

    /** The assigned provider backs out. The booking returns to `searching`, not a terminal state. */
    async release(userId: string, bookingId: string, reason: string, language: AppLanguage) {
      const providerProfileId = await requireProviderProfileId(userId);
      const core = await requireOwnCore(
        bookingId,
        (c) => c.providerProfileId === providerProfileId,
      );
      if (!RELEASABLE_STATUSES.includes(core.status)) {
        throw invalidState('This booking can no longer be released.');
      }

      const now = clock();
      const released = await db.transaction(async (tx) => {
        const repo = createBookingsRepository(tx);
        const ok = await repo.releaseAssignment(bookingId, providerProfileId);
        if (!ok) return false;
        await repo.insertProviderRelease(bookingId, providerProfileId, reason, now);
        return true;
      });
      if (!released) throw invalidState('This booking can no longer be released.');
      return loadForViewer(bookingId, userId, language);
    },

    async cancel(userId: string, bookingId: string, reason: string, language: AppLanguage) {
      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (!CANCELLABLE_STATUSES.includes(core.status)) {
        throw invalidState('This booking can no longer be cancelled.');
      }
      if (!(await repository.cancelByCustomer(bookingId, userId, reason, clock()))) {
        throw invalidState('This booking can no longer be cancelled.');
      }
      return loadForViewer(bookingId, userId, language);
    },

    // ---- quotes -------------------------------------------------------------

    async submitQuote(
      userId: string,
      bookingId: string,
      input: SubmitQuoteInput,
      language: AppLanguage,
    ) {
      const providerProfileId = await requireProviderProfileId(userId);
      const core = await requireCore(bookingId);

      if (core.pricingModel !== 'quote') {
        throw new AppError(409, ErrorCode.QuoteNotApplicable, 'This service is not quote-based.');
      }
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open for quotes.');
      }
      if (!(await isBookable(providerProfileId, core))) throw notEligible();

      try {
        await repository.insertQuote(
          bookingId,
          providerProfileId,
          input.amount.toFixed(2),
          blankToNull(input.note),
        );
      } catch (error) {
        if (isUniqueViolation(error, 'booking_quotes_booking_provider_active_uidx')) {
          throw new AppError(
            409,
            ErrorCode.AlreadyQuoted,
            'You already have a quote on this booking.',
          );
        }
        throw error;
      }
      return loadForViewer(bookingId, userId, language);
    },

    async acceptQuote(userId: string, bookingId: string, quoteId: string, language: AppLanguage) {
      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open.');
      }

      const quote = await repository.findQuoteCore(quoteId);
      if (quote?.bookingId !== bookingId) throw notFound('Quote not found.');
      if (quote.status !== 'pending') {
        throw invalidState('This quote has already been responded to.');
      }

      const now = clock();
      const accepted = await db.transaction(async (tx) => {
        const repo = createBookingsRepository(tx);
        const bookingOk = await repo.acceptQuoteOnBooking(
          bookingId,
          quote.providerProfileId,
          quote.amount,
          now,
        );
        if (!bookingOk) return false;
        const quoteOk = await repo.markQuoteAccepted(quoteId, now);
        if (!quoteOk) return false;
        await repo.rejectOtherPendingQuotes(bookingId, quoteId, now);
        return true;
      });
      if (!accepted) throw invalidState('This booking is no longer open.');
      return loadForViewer(bookingId, userId, language);
    },

    async rejectQuote(userId: string, bookingId: string, quoteId: string, language: AppLanguage) {
      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open.');
      }

      const quote = await repository.findQuoteCore(quoteId);
      if (quote?.bookingId !== bookingId) throw notFound('Quote not found.');

      if (!(await repository.rejectQuote(quoteId, clock()))) {
        throw invalidState('This quote has already been responded to.');
      }
      return loadForViewer(bookingId, userId, language);
    },
  };
}

export type BookingsService = ReturnType<typeof createBookingsService>;
