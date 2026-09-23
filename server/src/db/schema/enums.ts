import { pgEnum } from 'drizzle-orm/pg-core';

// Native PostgreSQL enums. Adding a value later is a cheap, non-blocking
// `ALTER TYPE ... ADD VALUE`. Removing or renaming one is a deliberate,
// manual migration, which is appropriate for values with business meaning.

/** Account state. Suspension blocks the whole account regardless of role. */
export const userStatus = pgEnum('user_status', ['active', 'suspended']);

/** UI languages supported at launch: English, Sinhala, Tamil. */
export const appLanguage = pgEnum('app_language', ['en', 'si', 'ta']);

/** How a service category is priced. Rates themselves live elsewhere (later). */
export const pricingModel = pgEnum('pricing_model', ['fixed', 'hourly', 'quote']);

/** Admin decision about one provider offering one category. */
export const providerServiceStatus = pgEnum('provider_service_status', [
  'pending',
  'approved',
  'rejected',
  'suspended',
]);

/**
 * Whether the provider as a person has been checked. Separate from the
 * per-category approvals in `provider_services`: a provider must be both
 * verified and approved for a category before they can be booked for it.
 */
export const providerVerificationStatus = pgEnum('provider_verification_status', [
  'draft',
  'submitted',
  'verified',
  'rejected',
]);

/** Provider's own online/offline toggle (persisted intent; live presence comes later). */
export const providerAvailability = pgEnum('provider_availability', ['offline', 'online']);

/** Whether the customer wants the work now or at a chosen time. */
export const bookingType = pgEnum('booking_type', ['on_demand', 'scheduled']);

/**
 * A booking's stage. Transitions are explicit and one-directional except for
 * a provider cancelling after acceptance, which returns the booking to
 * `searching` rather than ending it, so automatic re-dispatch (Sprint 6) has
 * somewhere to pick it back up.
 *
 *   searching -> accepted -> en_route -> arrived -> in_progress -> completed
 *   searching/accepted/en_route/arrived -> cancelled   (customer, terminal)
 *   accepted/en_route/arrived -> searching             (provider releases)
 *   searching -> expired                               (no provider accepted in time, terminal)
 */
export const bookingStatus = pgEnum('booking_status', [
  'searching',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
]);

/** A provider's proposed price for a quote-priced booking. */
export const bookingQuoteStatus = pgEnum('booking_quote_status', [
  'pending',
  'accepted',
  'rejected',
]);

/**
 * One provider's dispatch offer for a booking. `superseded` covers two cases:
 * another provider's offer was accepted first, or the customer/system cleared
 * every outstanding offer (e.g. the booking was cancelled). A provider is
 * offered a booking at most once, ever, regardless of wave or outcome.
 */
export const bookingOfferStatus = pgEnum('booking_offer_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'superseded',
]);

export type UserStatus = (typeof userStatus.enumValues)[number];
export type AppLanguage = (typeof appLanguage.enumValues)[number];
export type PricingModel = (typeof pricingModel.enumValues)[number];
export type ProviderServiceStatus = (typeof providerServiceStatus.enumValues)[number];
export type ProviderAvailability = (typeof providerAvailability.enumValues)[number];
export type ProviderVerificationStatus = (typeof providerVerificationStatus.enumValues)[number];
export type BookingType = (typeof bookingType.enumValues)[number];
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type BookingQuoteStatus = (typeof bookingQuoteStatus.enumValues)[number];
export type BookingOfferStatus = (typeof bookingOfferStatus.enumValues)[number];
