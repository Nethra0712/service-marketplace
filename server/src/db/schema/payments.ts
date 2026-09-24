import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { timestamps } from './columns.js';
import { bookings } from './bookings.js';
import { paymentProviderName, paymentStatus } from './enums.js';
import { providerPayouts } from './provider-payouts.js';
import { providerProfiles } from './provider-profiles.js';

/**
 * One payment attempt for one completed booking. The financial breakdown
 * (service amount, commission, provider earning) is computed and stored here
 * by the server at creation time and never taken from the client — see
 * `commission.ts` and `payments.service.ts`. `payment_ledger_entries` holds
 * the immutable audit trail of how this row got to its current state; this
 * table is the current, mutable snapshot.
 *
 * At most one `pending`/`succeeded` payment may exist per booking at a time
 * (`payments_booking_active_uidx`), so a booking can never have two
 * concurrently "live" payment attempts.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    /**
     * Denormalized from the booking at creation time (a completed booking's
     * assignment never changes). A payment is fundamentally "this provider
     * earned X"; storing it directly here is what makes payout calculation a
     * plain, indexed query instead of a join through every payment's booking.
     */
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    provider: paymentProviderName().notNull(),
    status: paymentStatus().notNull().default('pending'),

    /** The booking's agreed amount, snapshotted at payment creation. */
    serviceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    /** Basis points actually used (1500 = 15.00%), snapshotted so a later rate change never rewrites history. */
    commissionBasisPoints: integer().notNull(),
    commissionAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    /**
     * What the gateway charges the platform, if/when known. PayHere's webhook
     * does not report this, so it stays null in practice for now; reserved
     * for when a settlement report or a richer API makes it available.
     */
    gatewayFeeAmount: numeric({ precision: 12, scale: 2 }),
    /** serviceAmount - commissionAmount (see `commission.ts` for the rounding rule). */
    providerEarningAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    currency: text().notNull().default('LKR'),

    /** This app's own id for the attempt, sent to the gateway as its order id. One per payment row, always. */
    externalReference: text().notNull(),
    /** The gateway's own id for the payment, once it reports one. */
    providerPaymentId: text(),

    /** Set once this payment is swept into a weekly payout. Null until then. */
    payoutId: uuid().references(() => providerPayouts.id, { onDelete: 'restrict' }),

    succeededAt: timestamp({ withTimezone: true }),
    failedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    refundedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_external_reference_uidx').on(t.externalReference),
    index('payments_booking_idx').on(t.bookingId, t.status, t.createdAt),
    index('payments_payout_idx').on(t.payoutId),
    // "This provider's succeeded, not-yet-paid-out payments in period X" — the payout calculation's main query.
    index('payments_provider_payout_lookup_idx').on(t.providerProfileId, t.status, t.succeededAt),
    uniqueIndex('payments_booking_active_uidx')
      .on(t.bookingId)
      .where(sql`${t.status} in ('pending', 'succeeded')`),

    check('payments_service_amount_positive', sql`${t.serviceAmount} > 0`),
    check('payments_commission_amount_non_negative', sql`${t.commissionAmount} >= 0`),
    check(
      'payments_commission_basis_points_range',
      sql`${t.commissionBasisPoints} between 0 and 10000`,
    ),
    check('payments_provider_earning_non_negative', sql`${t.providerEarningAmount} >= 0`),
    check(
      'payments_gateway_fee_non_negative',
      sql`${t.gatewayFeeAmount} is null or ${t.gatewayFeeAmount} >= 0`,
    ),
    // `succeededAt` is set the moment a payment first succeeds and is never
    // cleared by refunding it (refund only ever moves a payment OUT of
    // `succeeded`, into `refunded`), so both statuses require it to be set —
    // the same "never cleared by moving further on" pattern `bookings`' own
    // stage timestamps use.
    check(
      'payments_succeeded_at_matches_status',
      sql`(${t.status} in ('succeeded', 'refunded')) = (${t.succeededAt} is not null)`,
    ),
    check(
      'payments_failed_at_matches_status',
      sql`(${t.status} = 'failed') = (${t.failedAt} is not null)`,
    ),
    check(
      'payments_cancelled_at_matches_status',
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
    check(
      'payments_refunded_at_matches_status',
      sql`(${t.status} = 'refunded') = (${t.refundedAt} is not null)`,
    ),
    // A payment only joins a payout once it has actually brought in money (or,
    // transiently, right after that money was refunded — the payout, if
    // already paid out, is reconciled separately; see payments.service.ts).
    check(
      'payments_payout_only_when_settled',
      sql`${t.payoutId} is null or ${t.status} in ('succeeded', 'refunded')`,
    ),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
