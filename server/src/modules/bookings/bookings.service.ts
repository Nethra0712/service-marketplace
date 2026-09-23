import type {
  AppLanguage,
  BookingOfferStatus,
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
  type OfferSummary,
  type QuoteRow,
} from './bookings.repository.js';

/** How long each dispatch offer stays open before lapsing to the next wave. */
export const OFFER_RESPONSE_WINDOW_MS = 45_000;
/** How long a booking stays in matching altogether before it gives up. */
export const MATCHING_WINDOW_MS = 30 * 60_000;

export interface QuoteView {
  id: string;
  status: BookingQuoteStatus;
  amount: string;
  note: string | null;
  provider: { id: string; fullName: string | null };
  createdAt: string;
  respondedAt: string | null;
}

export interface OfferView {
  status: BookingOfferStatus;
  wave: number;
  respondsBy: string;
  distanceKm: string | null;
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
  /** The viewing provider's own dispatch offer on this booking, if any. Always null for a customer. */
  myOffer: OfferView | null;
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
  /** Optional job coordinates, used only as a matching input (distance ranking). */
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
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

/**
 * The next dispatch wave for a booking: the best still-eligible candidates,
 * excluding anyone already offered it. Supplied by the matching module.
 */
export type NextWaveLookup = (
  offering: { serviceCategoryId: string; cityId: string },
  excludeProviderProfileIds: readonly string[],
  jobLocation: { latitude: number; longitude: number } | null,
) => Promise<{ providerProfileId: string; distanceKm: number | null }[]>;

export interface BookingsServiceDeps {
  db: Database;
  clock: Clock;
  findOfferedCategory: OfferedCategoryLookup;
  findProviderProfileId: ProviderProfileLookup;
  isBookable: EligibilityCheck;
  findNextWave: NextWaveLookup;
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
  myOffer: null,
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

const toOfferView = (row: OfferSummary): OfferView => ({
  status: row.status,
  wave: row.wave,
  respondsBy: row.respondsBy.toISOString(),
  distanceKm: row.distanceKm,
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
const noActiveOffer = () =>
  new AppError(
    409,
    ErrorCode.NoActiveOffer,
    'You do not have an active offer on this booking right now.',
  );

/** Thrown (never surfaced) to force a transaction rollback when an offer-side write loses a race. */
class OfferLostRace extends Error {}
const OFFER_LOST_RACE = new OfferLostRace();

/**
 * Booking self-service for customers and providers, plus the automatic
 * matching/dispatch that assigns a provider without the client choosing one.
 * Every method authorizes against the caller (never a supplied id), and
 * every state change goes through a guarded conditional update so a lost
 * race becomes a clean 409 instead of a corrupted booking.
 *
 * Matching has no scheduler: there is no background job anywhere in this
 * codebase, so offer/booking expiry is settled lazily, at the start of
 * whichever request next touches the booking (see {@link settle}).
 */
export function createBookingsService({
  db,
  clock,
  findOfferedCategory,
  findProviderProfileId,
  isBookable,
  findNextWave,
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
   * Creates and stores one dispatch wave, if anyone is currently eligible. A
   * no-op otherwise. There is no lock around "decide the next wave number,
   * then insert it": two concurrent requests settling the same idle booking
   * at the same instant could both attempt it. That is rare (settlement only
   * runs when the previous wave is already fully resolved) and harmless — the
   * losing attempt's insert hits `booking_offers_booking_provider_wave_uidx`
   * or `..._pending_uidx` and is treated as "someone else already dispatched
   * this wave," not an error.
   */
  async function dispatchWave(
    bookingId: string,
    target: { serviceCategoryId: string; cityId: string },
    jobLocation: { latitude: number; longitude: number } | null,
    now: Date,
  ): Promise<void> {
    const excluded = await repository.listExcludedProviderIds(bookingId);
    const nextWave = (await repository.maxOfferWave(bookingId)) + 1;
    const candidates = await findNextWave(target, excluded, jobLocation);
    if (candidates.length === 0) return; // Nobody eligible right now; stays searching until it expires.
    try {
      await repository.insertOfferWave(
        bookingId,
        nextWave,
        candidates,
        now,
        new Date(now.getTime() + OFFER_RESPONSE_WINDOW_MS),
      );
    } catch (error) {
      if (
        !isUniqueViolation(error, 'booking_offers_booking_provider_wave_uidx') &&
        !isUniqueViolation(error, 'booking_offers_booking_provider_pending_uidx')
      ) {
        throw error;
      }
    }
  }

  const jobLocationOf = (core: {
    customerLatitude: string | null;
    customerLongitude: string | null;
  }): { latitude: number; longitude: number } | null =>
    core.customerLatitude !== null && core.customerLongitude !== null
      ? { latitude: Number(core.customerLatitude), longitude: Number(core.customerLongitude) }
      : null;

  /**
   * Brings a `searching` booking's dispatch state up to date before anything
   * reads or acts on it: expires offers nobody answered in time, expires the
   * booking itself once its matching window has passed, and starts the next
   * wave if the current one is fully resolved and the booking is still open.
   * A no-op for any booking that is not `searching`.
   */
  async function settle(bookingId: string, now: Date): Promise<void> {
    const core = await repository.findCore(bookingId);
    if (core?.status !== 'searching') return;

    if (core.matchingExpiresAt !== null && core.matchingExpiresAt.getTime() <= now.getTime()) {
      await db.transaction(async (tx) => {
        const repo = createBookingsRepository(tx);
        await repo.expireDueOffers(bookingId, now);
        await repo.expireBooking(bookingId);
      });
      return;
    }

    await repository.expireDueOffers(bookingId, now);
    if ((await repository.countPendingOffers(bookingId)) === 0) {
      await dispatchWave(
        bookingId,
        { serviceCategoryId: core.serviceCategoryId, cityId: core.cityId },
        jobLocationOf(core),
        now,
      );
    }
  }

  /**
   * Loads a booking for whoever is allowed to see it: its customer, its
   * assigned provider, or a provider who currently holds (or has ever held)
   * a dispatch offer on it. A provider who was never offered this booking
   * gets the same 404 a missing booking would — matching decides who can see
   * an open booking, not the client. Quotes are attached per the viewer's
   * role, never both sides' at once.
   */
  async function loadForViewer(
    bookingId: string,
    userId: string,
    language: AppLanguage,
  ): Promise<BookingDetailView> {
    const row = await repository.findById(bookingId, language);
    if (!row) throw notFound('Booking not found.');

    const isCustomer = row.customerId === userId;
    const callerProviderProfileId = isCustomer ? undefined : await findProviderProfileId(userId);
    const isAssignedProvider =
      row.providerProfileId !== null && row.providerProfileId === callerProviderProfileId;

    let myOffer: OfferSummary | undefined;
    let canView = isCustomer || isAssignedProvider;
    if (callerProviderProfileId) {
      myOffer = await repository.findOfferForProvider(bookingId, callerProviderProfileId);
      if (!canView) canView = myOffer !== undefined;
    }
    if (!canView) throw notFound('Booking not found.');

    let quotes: QuoteView[] = [];
    if (row.pricingModel === 'quote') {
      if (isCustomer) {
        quotes = (await repository.listQuotesForBooking(bookingId)).map(toQuoteView);
      } else if (callerProviderProfileId) {
        quotes = (await repository.listMyQuotes(bookingId, callerProviderProfileId)).map(
          toQuoteView,
        );
      }
    }
    return {
      ...toSummaryView(row),
      myOffer: myOffer ? toOfferView(myOffer) : null,
      quotes,
    };
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
      const now = clock();
      if (scheduledAt !== null && scheduledAt.getTime() <= now.getTime()) {
        throw new AppError(
          400,
          ErrorCode.ValidationError,
          'Scheduled time must be in the future.',
          {
            details: [{ path: 'scheduledAt', message: 'Must be in the future.' }],
          },
        );
      }

      const customerLatitude =
        input.latitude === undefined || input.latitude === null ? null : input.latitude.toFixed(6);
      const customerLongitude =
        input.longitude === undefined || input.longitude === null
          ? null
          : input.longitude.toFixed(6);
      const matchingExpiresAt = new Date(now.getTime() + MATCHING_WINDOW_MS);

      const { id } = await repository.insert({
        customerId,
        serviceCategoryId: offered.serviceCategoryId,
        cityId: offered.cityId,
        bookingType: input.bookingType,
        pricingModel: offered.pricingModel,
        scheduledAt,
        customerNotes: blankToNull(input.customerNotes),
        serviceAddress: input.serviceAddress.trim(),
        customerLatitude,
        customerLongitude,
        matchingExpiresAt,
      });

      await dispatchWave(
        id,
        { serviceCategoryId: offered.serviceCategoryId, cityId: offered.cityId },
        customerLatitude !== null && customerLongitude !== null
          ? { latitude: Number(customerLatitude), longitude: Number(customerLongitude) }
          : null,
        now,
      );
      return loadForViewer(id, customerId, language);
    },

    async getForViewer(
      userId: string,
      bookingId: string,
      language: AppLanguage,
    ): Promise<BookingDetailView> {
      await settle(bookingId, clock());
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

    /** The caller's currently live dispatch offers — bookings automatic matching has offered them. */
    async listOffersForProvider(userId: string, language: AppLanguage) {
      const providerProfileId = await findProviderProfileId(userId);
      if (!providerProfileId) throw profileNotFound();
      const rows = await repository.listMyOffers(providerProfileId, language, clock());
      return rows.map(({ booking, offer }) => ({
        ...toSummaryView(booking),
        myOffer: toOfferView(offer),
      }));
    },

    /** A provider directly accepts an open fixed/hourly request they currently hold an offer on. */
    async accept(userId: string, bookingId: string, language: AppLanguage) {
      const now = clock();
      await settle(bookingId, now);

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

      const offer = await repository.findOfferForProvider(bookingId, providerProfileId);
      if (offer?.status !== 'pending' || offer.respondsBy.getTime() <= now.getTime()) {
        if (!(await isBookable(providerProfileId, core))) throw notEligible();
        throw noActiveOffer();
      }

      // `acceptDirect`'s booking-level guard (`status = 'searching'`) is the
      // primary race-resolver: only one of several concurrent accept
      // attempts can ever succeed at it. It runs BEFORE `consumeOfferForAccept`
      // on purpose — that call writes to the `(booking_id) WHERE status =
      // 'accepted'` unique index, and if two transactions both reached it
      // concurrently (as they would if this ran first), the loser would fail
      // with a raw unique-violation instead of the clean 409 below. If
      // `consumeOfferForAccept` somehow still fails after `acceptDirect`
      // already succeeded (e.g. the offer was declined in a separate, racing
      // request), throwing — not returning false — rolls the whole attempt
      // back, so `acceptDirect`'s write is never left committed on its own.
      const accepted = await db
        .transaction(async (tx) => {
          const repo = createBookingsRepository(tx);
          if (!(await repo.acceptDirect(bookingId, providerProfileId, now))) return false;
          if (!(await repo.consumeOfferForAccept(bookingId, providerProfileId, now))) {
            throw OFFER_LOST_RACE;
          }
          await repo.supersedeOtherPendingOffers(bookingId, providerProfileId, now);
          return true;
        })
        .catch((error: unknown) => {
          if (error instanceof OfferLostRace) return false;
          throw error;
        });
      if (!accepted) throw invalidState('This booking has already been taken.');
      return loadForViewer(bookingId, userId, language);
    },

    /** A provider turns down their current offer. If it was the last one out, dispatch moves on immediately. */
    async decline(userId: string, bookingId: string, language: AppLanguage) {
      const now = clock();
      await settle(bookingId, now);

      const providerProfileId = await requireProviderProfileId(userId);
      await requireCore(bookingId);

      if (!(await repository.declineOffer(bookingId, providerProfileId, now))) {
        throw noActiveOffer();
      }

      const core = await repository.findCore(bookingId);
      if (core?.status === 'searching' && (await repository.countPendingOffers(bookingId)) === 0) {
        await dispatchWave(
          bookingId,
          { serviceCategoryId: core.serviceCategoryId, cityId: core.cityId },
          jobLocationOf(core),
          now,
        );
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

    /**
     * The assigned provider backs out. The booking returns to `searching` and
     * matching re-dispatches immediately, excluding the releasing provider
     * (see `listExcludedProviderIds`).
     */
    async release(userId: string, bookingId: string, reason: string, language: AppLanguage) {
      const now = clock();
      await settle(bookingId, now);

      const providerProfileId = await requireProviderProfileId(userId);
      const core = await requireOwnCore(
        bookingId,
        (c) => c.providerProfileId === providerProfileId,
      );
      if (!RELEASABLE_STATUSES.includes(core.status)) {
        throw invalidState('This booking can no longer be released.');
      }

      const released = await db.transaction(async (tx) => {
        const repo = createBookingsRepository(tx);
        const ok = await repo.releaseAssignment(bookingId, providerProfileId);
        if (!ok) return false;
        await repo.insertProviderRelease(bookingId, providerProfileId, reason, now);
        await repo.supersedeAcceptedOffer(bookingId, providerProfileId, now);
        return true;
      });
      if (!released) throw invalidState('This booking can no longer be released.');

      const freshCore = await repository.findCore(bookingId);
      if (freshCore) {
        await dispatchWave(
          bookingId,
          { serviceCategoryId: freshCore.serviceCategoryId, cityId: freshCore.cityId },
          jobLocationOf(freshCore),
          now,
        );
      }
      return loadForViewer(bookingId, userId, language);
    },

    async cancel(userId: string, bookingId: string, reason: string, language: AppLanguage) {
      const now = clock();
      await settle(bookingId, now);

      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (!CANCELLABLE_STATUSES.includes(core.status)) {
        throw invalidState('This booking can no longer be cancelled.');
      }
      if (!(await repository.cancelByCustomer(bookingId, userId, reason, now))) {
        throw invalidState('This booking can no longer be cancelled.');
      }
      await repository.supersedeAllPendingOffers(bookingId, now);
      if (core.providerProfileId) {
        await repository.supersedeAcceptedOffer(bookingId, core.providerProfileId, now);
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
      const now = clock();
      await settle(bookingId, now);

      const providerProfileId = await requireProviderProfileId(userId);
      const core = await requireCore(bookingId);

      if (core.pricingModel !== 'quote') {
        throw new AppError(409, ErrorCode.QuoteNotApplicable, 'This service is not quote-based.');
      }
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open for quotes.');
      }

      const offer = await repository.findOfferForProvider(bookingId, providerProfileId);
      if (offer?.status !== 'pending' || offer.respondsBy.getTime() <= now.getTime()) {
        if (!(await isBookable(providerProfileId, core))) throw notEligible();
        throw noActiveOffer();
      }

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
      const now = clock();
      await settle(bookingId, now);

      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open.');
      }

      const quote = await repository.findQuoteCore(quoteId);
      if (quote?.bookingId !== bookingId) throw notFound('Quote not found.');
      if (quote.status !== 'pending') {
        throw invalidState('This quote has already been responded to.');
      }

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
        // Keep the offer rows honest: the quote is what actually decided the
        // winner here (a customer can only accept one quote at a time, so
        // there is no accept/accept race to guard against the way there is
        // for a direct accept), but the winning provider's offer should read
        // "accepted" rather than sitting "pending" forever, and everyone
        // else's should stop showing as a live offer.
        await repo.consumeOfferForAccept(bookingId, quote.providerProfileId, now);
        await repo.supersedeOtherPendingOffers(bookingId, quote.providerProfileId, now);
        return true;
      });
      if (!accepted) throw invalidState('This booking is no longer open.');
      return loadForViewer(bookingId, userId, language);
    },

    async rejectQuote(userId: string, bookingId: string, quoteId: string, language: AppLanguage) {
      const now = clock();
      await settle(bookingId, now);

      const core = await requireOwnCore(bookingId, (c) => c.customerId === userId);
      if (core.status !== 'searching') {
        throw invalidState('This booking is no longer open.');
      }

      const quote = await repository.findQuoteCore(quoteId);
      if (quote?.bookingId !== bookingId) throw notFound('Quote not found.');

      if (!(await repository.rejectQuote(quoteId, now))) {
        throw invalidState('This quote has already been responded to.');
      }
      return loadForViewer(bookingId, userId, language);
    },
  };
}

export type BookingsService = ReturnType<typeof createBookingsService>;
