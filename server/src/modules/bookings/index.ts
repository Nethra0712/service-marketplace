import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import type { Logger } from '../../lib/logger.js';
import { createBookingsRouter } from './bookings.routes.js';
import {
  createBookingsService,
  type BookingCompletedHook,
  type BookingNotificationHook,
  type BookingsService,
  type EligibilityCheck,
  type NextWaveLookup,
  type OfferedCategoryLookup,
  type ProviderProfileLookup,
} from './bookings.service.js';

export type { BookingCompletedHook, BookingNotificationHook } from './bookings.service.js';

export type {
  BookingDetailView,
  BookingSummaryView,
  OfferView,
  QuoteView,
  CreateBookingInput,
  SubmitQuoteInput,
} from './bookings.service.js';

export interface BookingsModuleDeps {
  db: Database;
  clock: Clock;
  /** From the auth module: protects every booking route. */
  requireAuth: RequestHandler;
  /** From the catalogue module. */
  findOfferedCategory: OfferedCategoryLookup;
  /** From the providers module. */
  findProviderProfileId: ProviderProfileLookup;
  isBookable: EligibilityCheck;
  /** From the matching module. */
  findNextWave: NextWaveLookup;
  /** From the payments module. Runs after a booking completes; failures are logged, never fatal to completion. */
  onBookingCompleted?: BookingCompletedHook;
  /** From the notifications module. Failures are logged, never fatal to the action that triggered them. */
  notifyBookingEvent?: BookingNotificationHook;
  /** From the providers module: resolves a provider profile id to its owner's user id. */
  findProviderUserId?: (providerProfileId: string) => Promise<string | undefined>;
  /** From the realtime module (indirectly — see `app.ts`'s own comment on why). Drops cached live-location state once a booking leaves a trackable stage. */
  onBookingEnded?: (bookingId: string) => void;
  logger?: Logger;
}

export interface BookingsModule {
  /** Mount at /api/bookings. */
  router: Router;
  service: BookingsService;
}

/** The bookings module's public surface. */
export function createBookingsModule({
  db,
  clock,
  requireAuth,
  findOfferedCategory,
  findProviderProfileId,
  isBookable,
  findNextWave,
  onBookingCompleted,
  notifyBookingEvent,
  findProviderUserId,
  onBookingEnded,
  logger,
}: BookingsModuleDeps): BookingsModule {
  const service = createBookingsService({
    db,
    clock,
    findOfferedCategory,
    findProviderProfileId,
    isBookable,
    findNextWave,
    onBookingCompleted,
    notifyBookingEvent,
    findProviderUserId,
    onBookingEnded,
    logger,
  });
  return { router: createBookingsRouter({ service, requireAuth }), service };
}
