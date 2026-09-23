import type { RequestHandler, Router } from 'express';

import type { Database } from '../../db/client.js';
import type { Clock } from '../../lib/clock.js';
import { createBookingsRouter } from './bookings.routes.js';
import {
  createBookingsService,
  type BookingsService,
  type EligibilityCheck,
  type EligibleOfferingsLookup,
  type OfferedCategoryLookup,
  type ProviderProfileLookup,
} from './bookings.service.js';

export type {
  BookingDetailView,
  BookingSummaryView,
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
  listEligibleOfferings: EligibleOfferingsLookup;
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
  listEligibleOfferings,
}: BookingsModuleDeps): BookingsModule {
  const service = createBookingsService({
    db,
    clock,
    findOfferedCategory,
    findProviderProfileId,
    isBookable,
    listEligibleOfferings,
  });
  return { router: createBookingsRouter({ service, requireAuth }), service };
}
