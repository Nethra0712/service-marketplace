import { sql } from 'drizzle-orm';
import { check, index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { payments } from './payments.js';
import { paymentLedgerEntryKind, paymentStatus } from './enums.js';

/**
 * One immutable event in a payment's audit trail: created, a callback that
 * moved it to succeeded/failed/cancelled, a refund, or a duplicate callback
 * that was correctly ignored. Rows here are never updated or deleted —
 * `payments` itself is the current, mutable state; this table is *why* it got
 * there. Each row snapshots the full financial breakdown as it stood at that
 * event, so the ledger is self-contained and auditable without joining back
 * to `payments`' current (and therefore possibly since-changed) row.
 *
 * Deliberately has no `updatedAt`: nothing here is ever expected to change
 * after it is written.
 */
export const paymentLedgerEntries = pgTable(
  'payment_ledger_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    kind: paymentLedgerEntryKind().notNull(),
    /** The payment's status this entry represents (for `duplicate_ignored`, the status the duplicate attempted, not one that was actually applied). */
    status: paymentStatus().notNull(),

    serviceAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    commissionAmount: numeric({ precision: 12, scale: 2 }).notNull(),
    gatewayFeeAmount: numeric({ precision: 12, scale: 2 }),
    providerEarningAmount: numeric({ precision: 12, scale: 2 }).notNull(),

    externalReference: text().notNull(),
    providerPaymentId: text(),

    /** Raw gateway callback payload, when this entry came from one. Never contains card/payment credentials — PayHere's webhook never includes them. */
    rawPayload: jsonb(),
    /** Free-text context, e.g. "duplicate callback ignored" or an admin's refund reason. */
    note: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payment_ledger_entries_payment_idx').on(t.paymentId, t.createdAt),
    check('payment_ledger_entries_service_amount_positive', sql`${t.serviceAmount} > 0`),
    check('payment_ledger_entries_commission_amount_non_negative', sql`${t.commissionAmount} >= 0`),
    check(
      'payment_ledger_entries_provider_earning_non_negative',
      sql`${t.providerEarningAmount} >= 0`,
    ),
  ],
);

export type PaymentLedgerEntry = typeof paymentLedgerEntries.$inferSelect;
export type NewPaymentLedgerEntry = typeof paymentLedgerEntries.$inferInsert;
