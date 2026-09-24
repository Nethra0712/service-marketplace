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
import { payoutStatus } from './enums.js';
import { providerProfiles } from './provider-profiles.js';

/**
 * One provider's payable amount for one payout period (a week, in practice).
 * Computed by summing that period's succeeded payments for the provider —
 * see `payments.service.ts#calculatePayoutsForPeriod`. Paying it out (the
 * actual bank transfer) is a manual, admin-side step in V1: this row only
 * tracks whether that has happened, never performs it.
 */
export const providerPayouts = pgTable(
  'provider_payouts',
  {
    id: uuid().primaryKey().defaultRandom(),
    providerProfileId: uuid()
      .notNull()
      .references(() => providerProfiles.id, { onDelete: 'restrict' }),
    /** The period this payout covers, half-open: `[periodStart, periodEnd)`. */
    periodStart: timestamp({ withTimezone: true }).notNull(),
    periodEnd: timestamp({ withTimezone: true }).notNull(),

    /** Sums across every payment this payout includes, snapshotted at calculation time. */
    totalServiceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    totalCommissionAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    totalGatewayFeeAmount: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    /** What the provider is actually owed. The number an admin pays out. */
    totalProviderEarningAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    paymentCount: integer().notNull(),

    status: payoutStatus().notNull().default('pending'),
    /** Set when an admin marks this paid (manual, out of band — see the module doc comment). */
    paidAt: timestamp({ withTimezone: true }),
    /** E.g. a bank transfer reference, filled in when marking paid. */
    note: text(),
    ...timestamps,
  },
  (t) => [
    index('provider_payouts_provider_idx').on(t.providerProfileId, t.periodStart),
    // At most one payout per provider per period: recomputing an already-calculated period is a no-op, not a duplicate.
    uniqueIndex('provider_payouts_provider_period_uidx').on(
      t.providerProfileId,
      t.periodStart,
      t.periodEnd,
    ),
    check('provider_payouts_period_valid', sql`${t.periodEnd} > ${t.periodStart}`),
    check(
      'provider_payouts_amounts_non_negative',
      sql`${t.totalServiceAmount} >= 0 and ${t.totalCommissionAmount} >= 0 and
          ${t.totalGatewayFeeAmount} >= 0 and ${t.totalProviderEarningAmount} >= 0`,
    ),
    check('provider_payouts_payment_count_non_negative', sql`${t.paymentCount} >= 0`),
    check(
      'provider_payouts_paid_at_matches_status',
      sql`(${t.status} = 'paid') = (${t.paidAt} is not null)`,
    ),
  ],
);

export type ProviderPayout = typeof providerPayouts.$inferSelect;
export type NewProviderPayout = typeof providerPayouts.$inferInsert;
