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

/** Which payment gateway processed (or will process) a payment. A closed set: the app never trusts a caller-supplied provider name. */
export const paymentProviderName = pgEnum('payment_provider_name', ['mock', 'payhere']);

/**
 * A payment's lifecycle. `pending` covers both "checkout not started/finished
 * yet" and "the gateway has not yet told us the outcome" — those are the same
 * state from this app's point of view, since only a verified callback (or an
 * explicit refund) ever moves it further.
 *
 *   pending -> succeeded -> refunded
 *   pending -> failed
 *   pending -> cancelled
 */
export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
]);

/**
 * One immutable event in a payment's audit trail. Never updated once
 * written; `payments` itself holds the current, mutable state.
 */
export const paymentLedgerEntryKind = pgEnum('payment_ledger_entry_kind', [
  'created',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'duplicate_ignored',
]);

/** A weekly provider payout's status. The actual bank transfer is manual in V1: this only tracks whether it has been done. */
export const payoutStatus = pgEnum('payout_status', ['pending', 'paid', 'cancelled']);

/** Which push backend a device token was registered through. A closed set: never trusted from the client beyond selecting one of these. */
export const pushProviderName = pgEnum('push_provider_name', ['mock', 'fcm']);

/** The OS a registered device token belongs to, for provider-specific payload shaping later. */
export const devicePlatform = pgEnum('device_platform', ['android', 'ios']);

/**
 * Every event the app can notify someone about. One in-app `notifications`
 * row and (if the recipient allows push) one push message per event —
 * see `notifications.service.ts`'s `notify`.
 */
export const notificationKind = pgEnum('notification_kind', [
  'booking_accepted',
  'provider_en_route',
  'provider_arrived',
  'booking_completed',
  'booking_cancelled',
  'quote_created',
  'quote_accepted',
  'quote_rejected',
  'payment_succeeded',
  'payment_failed',
  'payout_paid',
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
export type PaymentProviderName = (typeof paymentProviderName.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type PaymentLedgerEntryKind = (typeof paymentLedgerEntryKind.enumValues)[number];
export type PayoutStatus = (typeof payoutStatus.enumValues)[number];
export type PushProviderName = (typeof pushProviderName.enumValues)[number];
export type DevicePlatform = (typeof devicePlatform.enumValues)[number];
export type NotificationKind = (typeof notificationKind.enumValues)[number];

/**
 * Every sensitive admin action worth an audit trail entry. A closed set: the
 * app never trusts a caller-supplied action name (see `admin_audit_log`'s
 * doc comment).
 */
export const adminAuditAction = pgEnum('admin_audit_action', [
  'provider_application_reviewed',
  'provider_profile_reviewed',
  'user_suspended',
  'user_reactivated',
  'category_created',
  'category_updated',
  'payment_refunded',
  'payout_marked_paid',
  'review_hidden',
]);

export type AdminAuditAction = (typeof adminAuditAction.enumValues)[number];
