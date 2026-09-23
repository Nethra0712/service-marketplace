import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { createBookingsRouter } from './bookings.routes.js';
import {
  createBookingsService,
  type BookingsService,
  type EligibilityCheck,
  type NextWaveLookup,
  type OfferedCategoryLookup,
  type ProviderProfileLookup,
} from './bookings.service.js';

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
}: BookingsModuleDeps): BookingsModule {
  const service = createBookingsService({
    db,
    clock,
    findOfferedCategory,
    findProviderProfileId,
    isBookable,
    findNextWave,
  });
  return { router: createBookingsRouter({ service, requireAuth }), service };
}
