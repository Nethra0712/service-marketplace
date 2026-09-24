import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

import type { Queryable } from '../../db/client.js';
import {
  bookings,
  cities,
  paymentLedgerEntries,
  payments,
  profiles,
  providerPayouts,
  users,
  type BookingStatus,
  type NewPayment,
  type NewPaymentLedgerEntry,
  type NewProviderPayout,
  type Payment,
  type PaymentLedgerEntryKind,
  type PaymentStatus,
  type ProviderPayout,
} from '../../db/schema/index.js';

/**
 * What a checkout needs to know about the booking it is paying for.
 * `providerProfileId` is null for a booking with no provider assigned yet
 * (e.g. still `searching`) — reaching that far and finding it null is exactly
 * what makes `createPaymentRow` reject it as "not completed yet" rather than
 * treating an ordinary, still-open booking as if it did not exist.
 */
export interface PaymentBookingContext {
  bookingId: string;
  status: BookingStatus;
  customerId: string;
  customerPhone: string;
  customerFullName: string | null;
  providerProfileId: string | null;
  agreedAmount: string | null;
  serviceAddress: string;
  cityName: string;
}

export interface PayoutTotals {
  providerProfileId: string;
  totalServiceAmount: string;
  totalCommissionAmount: string;
  totalGatewayFeeAmount: string;
  totalProviderEarningAmount: string;
  paymentCount: number;
  paymentIds: string[];
}

/** All payment/ledger/payout data access. */
export function createPaymentsRepository(db: Queryable) {
  return {
    // ---- booking context ---------------------------------------------------

    async findBookingContext(bookingId: string): Promise<PaymentBookingContext | undefined> {
      const [row] = await db
        .select({
          bookingId: bookings.id,
          status: bookings.status,
          customerId: bookings.customerId,
          customerPhone: users.phoneE164,
          customerFullName: profiles.fullName,
          providerProfileId: bookings.providerProfileId,
          agreedAmount: bookings.agreedAmount,
          serviceAddress: bookings.serviceAddress,
          cityName: cities.name,
        })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.customerId))
        .leftJoin(profiles, eq(profiles.userId, bookings.customerId))
        .innerJoin(cities, eq(cities.id, bookings.cityId))
        .where(eq(bookings.id, bookingId));
      return row;
    },

    // ---- payments -----------------------------------------------------------

    async insert(values: NewPayment): Promise<Payment> {
      const [row] = await db.insert(payments).values(values).returning();
      if (!row) throw new Error('Payment insert returned no row');
      return row;
    },

    async findById(id: string): Promise<Payment | undefined> {
      const [row] = await db.select().from(payments).where(eq(payments.id, id));
      return row;
    },

    async findByExternalReference(externalReference: string): Promise<Payment | undefined> {
      const [row] = await db
        .select()
        .from(payments)
        .where(eq(payments.externalReference, externalReference));
      return row;
    },

    /** The one `pending`/`succeeded` payment for this booking, if any (see `payments_booking_active_uidx`). */
    async findActiveForBooking(bookingId: string): Promise<Payment | undefined> {
      const [row] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.bookingId, bookingId),
            inArray(payments.status, ['pending', 'succeeded']),
          ),
        );
      return row;
    },

    /** Every payment attempt for this booking, most recent first. */
    async listForBooking(bookingId: string): Promise<Payment[]> {
      return db
        .select()
        .from(payments)
        .where(eq(payments.bookingId, bookingId))
        .orderBy(desc(payments.createdAt));
    },

    /**
     * `pending` -> `succeeded`, only from `pending`. Returns the updated row, or
     * `undefined` if the payment was not `pending` (already settled by an
     * earlier, possibly duplicate, callback) — the idempotency guard.
     */
    async markSucceeded(
      paymentId: string,
      values: { providerPaymentId: string; succeededAt: Date },
    ): Promise<Payment | undefined> {
      const [row] = await db
        .update(payments)
        .set({
          status: 'succeeded',
          providerPaymentId: values.providerPaymentId,
          succeededAt: values.succeededAt,
        })
        .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
        .returning();
      return row;
    },

    async markFailed(
      paymentId: string,
      values: { providerPaymentId: string | null; failedAt: Date },
    ): Promise<Payment | undefined> {
      const [row] = await db
        .update(payments)
        .set({
          status: 'failed',
          providerPaymentId: values.providerPaymentId,
          failedAt: values.failedAt,
        })
        .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
        .returning();
      return row;
    },

    async markCancelled(
      paymentId: string,
      values: { providerPaymentId: string | null; cancelledAt: Date },
    ): Promise<Payment | undefined> {
      const [row] = await db
        .update(payments)
        .set({
          status: 'cancelled',
          providerPaymentId: values.providerPaymentId,
          cancelledAt: values.cancelledAt,
        })
        .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
        .returning();
      return row;
    },

    /** `succeeded` -> `refunded`, only from `succeeded` and only while not yet swept into a payout. */
    async markRefunded(paymentId: string, refundedAt: Date): Promise<Payment | undefined> {
      const [row] = await db
        .update(payments)
        .set({ status: 'refunded', refundedAt })
        .where(
          and(
            eq(payments.id, paymentId),
            eq(payments.status, 'succeeded'),
            isNull(payments.payoutId),
          ),
        )
        .returning();
      return row;
    },

    async assignToPayout(paymentIds: readonly string[], payoutId: string): Promise<void> {
      if (paymentIds.length === 0) return;
      await db.update(payments).set({ payoutId }).where(inArray(payments.id, paymentIds));
    },

    // ---- ledger (insert-only) ------------------------------------------------

    async insertLedgerEntry(values: NewPaymentLedgerEntry): Promise<void> {
      await db.insert(paymentLedgerEntries).values(values);
    },

    async listLedgerForPayment(paymentId: string) {
      return db
        .select()
        .from(paymentLedgerEntries)
        .where(eq(paymentLedgerEntries.paymentId, paymentId))
        .orderBy(asc(paymentLedgerEntries.createdAt));
    },

    // ---- payouts --------------------------------------------------------------

    /**
     * Every provider with at least one `succeeded`, not-yet-paid-out payment
     * whose money arrived (`succeededAt`) within `[periodStart, periodEnd)`,
     * summed. The payout calculation's whole read side.
     */
    async summarizeSucceededPaymentsForPeriod(
      periodStart: Date,
      periodEnd: Date,
    ): Promise<PayoutTotals[]> {
      const rows = await db
        .select({
          providerProfileId: payments.providerProfileId,
          serviceAmount: payments.serviceAmount,
          commissionAmount: payments.commissionAmount,
          gatewayFeeAmount: payments.gatewayFeeAmount,
          providerEarningAmount: payments.providerEarningAmount,
          id: payments.id,
        })
        .from(payments)
        .where(
          and(
            eq(payments.status, 'succeeded'),
            isNull(payments.payoutId),
            sql`${payments.succeededAt} is not null`,
            gte(payments.succeededAt, periodStart),
            lt(payments.succeededAt, periodEnd),
          ),
        );

      interface Accumulator {
        providerProfileId: string;
        serviceCents: number;
        commissionCents: number;
        gatewayFeeCents: number;
        providerEarningCents: number;
        paymentCount: number;
        paymentIds: string[];
      }
      const toCents = (decimal: string): number => Math.round(Number(decimal) * 100);

      const byProvider = new Map<string, Accumulator>();
      for (const row of rows) {
        const existing = byProvider.get(row.providerProfileId) ?? {
          providerProfileId: row.providerProfileId,
          serviceCents: 0,
          commissionCents: 0,
          gatewayFeeCents: 0,
          providerEarningCents: 0,
          paymentCount: 0,
          paymentIds: [],
        };
        byProvider.set(row.providerProfileId, {
          providerProfileId: row.providerProfileId,
          serviceCents: existing.serviceCents + toCents(row.serviceAmount),
          commissionCents: existing.commissionCents + toCents(row.commissionAmount),
          gatewayFeeCents: existing.gatewayFeeCents + toCents(row.gatewayFeeAmount ?? '0'),
          providerEarningCents: existing.providerEarningCents + toCents(row.providerEarningAmount),
          paymentCount: existing.paymentCount + 1,
          paymentIds: [...existing.paymentIds, row.id],
        });
      }
      return [...byProvider.values()].map((totals) => ({
        providerProfileId: totals.providerProfileId,
        totalServiceAmount: (totals.serviceCents / 100).toFixed(2),
        totalCommissionAmount: (totals.commissionCents / 100).toFixed(2),
        totalGatewayFeeAmount: (totals.gatewayFeeCents / 100).toFixed(2),
        totalProviderEarningAmount: (totals.providerEarningCents / 100).toFixed(2),
        paymentCount: totals.paymentCount,
        paymentIds: totals.paymentIds,
      }));
    },

    async findPayout(
      providerProfileId: string,
      periodStart: Date,
      periodEnd: Date,
    ): Promise<ProviderPayout | undefined> {
      const [row] = await db
        .select()
        .from(providerPayouts)
        .where(
          and(
            eq(providerPayouts.providerProfileId, providerProfileId),
            eq(providerPayouts.periodStart, periodStart),
            eq(providerPayouts.periodEnd, periodEnd),
          ),
        );
      return row;
    },

    /**
     * Every payout already calculated for this exact period, whatever
     * provider. What makes recomputing a period idempotent: a provider whose
     * payments are already all assigned to a payout no longer shows up in
     * {@link summarizeSucceededPaymentsForPeriod} at all, so that query alone
     * cannot tell "nothing to pay" apart from "already paid out" — this one
     * can.
     */
    async listPayoutsForPeriod(periodStart: Date, periodEnd: Date): Promise<ProviderPayout[]> {
      return db
        .select()
        .from(providerPayouts)
        .where(
          and(
            eq(providerPayouts.periodStart, periodStart),
            eq(providerPayouts.periodEnd, periodEnd),
          ),
        );
    },

    async insertPayout(values: NewProviderPayout): Promise<ProviderPayout> {
      const [row] = await db.insert(providerPayouts).values(values).returning();
      if (!row) throw new Error('Payout insert returned no row');
      return row;
    },

    async findPayoutById(id: string): Promise<ProviderPayout | undefined> {
      const [row] = await db.select().from(providerPayouts).where(eq(providerPayouts.id, id));
      return row;
    },

    async listPayoutsForProvider(providerProfileId: string): Promise<ProviderPayout[]> {
      return db
        .select()
        .from(providerPayouts)
        .where(eq(providerPayouts.providerProfileId, providerProfileId))
        .orderBy(desc(providerPayouts.periodStart));
    },

    /** `pending` -> `paid`, only from `pending`. An admin, manual step — see the module doc comment. */
    async markPayoutPaid(
      payoutId: string,
      paidAt: Date,
      note: string | null,
    ): Promise<ProviderPayout | undefined> {
      const [row] = await db
        .update(providerPayouts)
        .set({ status: 'paid', paidAt, note })
        .where(and(eq(providerPayouts.id, payoutId), eq(providerPayouts.status, 'pending')))
        .returning();
      return row;
    },
  };
}

export type PaymentsRepository = ReturnType<typeof createPaymentsRepository>;
export type { Payment, PaymentStatus, PaymentLedgerEntryKind, ProviderPayout };
