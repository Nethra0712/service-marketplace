import { randomUUID } from 'node:crypto';

import type { Database } from '../../db/client.js';
import type {
  NotificationKind,
  Payment,
  PaymentStatus,
  ProviderPayout,
} from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { calculateCommission } from './commission.js';
import { createPaymentsRepository, type PaymentsRepository } from './payments.repository.js';
import type { CheckoutSession, PaymentProvider } from './payment-provider.js';

/**
 * Notifies one user about a payment or payout event. Supplied by the
 * notifications module. Optional, and its failure never blocks the callback
 * or payout action that triggered it — same posture as bookings' own
 * `BookingNotificationHook`.
 */
export type PaymentNotificationHook = (event: {
  kind: NotificationKind;
  recipientUserId: string;
  bookingId?: string;
  paymentId?: string;
  payoutId?: string;
  params?: { amount: string; currency: string };
}) => Promise<void>;

export interface PaymentView {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  serviceAmount: string;
  commissionAmount: string;
  providerEarningAmount: string;
  currency: string;
  externalReference: string;
  providerPaymentId: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

export interface PayoutView {
  id: string;
  providerProfileId: string;
  periodStart: string;
  periodEnd: string;
  totalServiceAmount: string;
  totalCommissionAmount: string;
  totalGatewayFeeAmount: string;
  totalProviderEarningAmount: string;
  paymentCount: number;
  status: ProviderPayout['status'];
  paidAt: string | null;
}

export interface PaymentsServiceDeps {
  db: Database;
  clock: Clock;
  provider: PaymentProvider;
  /** Basis points, e.g. 1500 = 15.00%. Read from config; never hardcoded. */
  commissionBasisPoints: number;
  /** This API's own base URL, for building the gateway's return/cancel/notify URLs. */
  publicApiBaseUrl: string;
  /** From the notifications module. */
  onPaymentEvent?: PaymentNotificationHook;
  /** From the providers module: resolves a provider profile id to its owner's user id, for payout notifications. */
  findProviderUserId?: (providerProfileId: string) => Promise<string | undefined>;
  logger?: Logger;
}

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

const toPaymentView = (payment: Payment): PaymentView => ({
  id: payment.id,
  bookingId: payment.bookingId,
  status: payment.status,
  serviceAmount: payment.serviceAmount,
  commissionAmount: payment.commissionAmount,
  providerEarningAmount: payment.providerEarningAmount,
  currency: payment.currency,
  externalReference: payment.externalReference,
  providerPaymentId: payment.providerPaymentId,
  succeededAt: iso(payment.succeededAt),
  failedAt: iso(payment.failedAt),
  cancelledAt: iso(payment.cancelledAt),
  refundedAt: iso(payment.refundedAt),
  createdAt: payment.createdAt.toISOString(),
});

const toPayoutView = (payout: ProviderPayout): PayoutView => ({
  id: payout.id,
  providerProfileId: payout.providerProfileId,
  periodStart: payout.periodStart.toISOString(),
  periodEnd: payout.periodEnd.toISOString(),
  totalServiceAmount: payout.totalServiceAmount,
  totalCommissionAmount: payout.totalCommissionAmount,
  totalGatewayFeeAmount: payout.totalGatewayFeeAmount,
  totalProviderEarningAmount: payout.totalProviderEarningAmount,
  paymentCount: payout.paymentCount,
  status: payout.status,
  paidAt: iso(payout.paidAt),
});

const notFound = (message: string) => new AppError(404, ErrorCode.NotFound, message);
const paymentNotReady = (message: string) => new AppError(409, ErrorCode.PaymentNotReady, message);
const paymentAlreadyFinal = (message: string) =>
  new AppError(409, ErrorCode.PaymentAlreadyFinal, message);
const invalidCallback = () =>
  new AppError(400, ErrorCode.InvalidPaymentCallback, 'Invalid payment callback.');

/**
 * Payments, commission and payouts. Every amount the API returns is computed
 * here, server-side, from the booking's own `agreedAmount` and the
 * configured commission rate — never taken from a client, and never taken
 * unverified from a gateway callback (see `handleCallback`).
 *
 * `refundPayment` and `calculatePayoutsForPeriod`/`markPayoutPaid` are
 * intentionally not reachable over HTTP: there is no admin-auth concept in
 * this codebase yet (see `providers/review.service.ts` for the identical
 * pattern). They exist so the rules are implemented and tested now, driven
 * today by tests and the development-only `npm run dev:payouts` script,
 * ready for real admin tooling to call once it exists.
 */
export function createPaymentsService({
  db,
  clock,
  provider,
  commissionBasisPoints,
  publicApiBaseUrl,
  onPaymentEvent,
  findProviderUserId,
  logger,
}: PaymentsServiceDeps) {
  const repository = createPaymentsRepository(db);

  /** Fire-and-forget: never lets a notification failure undo or block the payment/payout action that triggered it. */
  async function notify(
    kind: NotificationKind,
    recipientUserId: string | null | undefined,
    event: {
      bookingId?: string;
      paymentId?: string;
      payoutId?: string;
      amount: string;
      currency: string;
    },
  ): Promise<void> {
    if (!onPaymentEvent || !recipientUserId) return;
    try {
      await onPaymentEvent({
        kind,
        recipientUserId,
        bookingId: event.bookingId,
        paymentId: event.paymentId,
        payoutId: event.payoutId,
        params: { amount: event.amount, currency: event.currency },
      });
    } catch (error) {
      logger?.error({ err: error, kind }, 'onPaymentEvent hook failed; continuing');
    }
  }

  /** The actual insert + `created` ledger entry, shared by both entry points below. */
  async function createPaymentRow(bookingId: string): Promise<Payment> {
    const context = await repository.findBookingContext(bookingId);
    if (!context) throw notFound('Booking not found.');
    if (context.status !== 'completed') {
      throw paymentNotReady('This booking has not been completed yet.');
    }
    if (context.agreedAmount === null || context.providerProfileId === null) {
      // Should not happen: a `completed` booking always has both, by the
      // bookings table's own `bookings_provider_matches_status` and
      // `bookings_completed_at_matches_status` invariants plus
      // `bookings.service.ts` settling `agreedAmount` no later than completion.
      throw paymentNotReady(
        'This booking is missing the pricing information needed to pay for it.',
      );
    }

    const breakdown = calculateCommission(context.agreedAmount, commissionBasisPoints);
    const providerProfileId = context.providerProfileId;
    return db.transaction(async (tx) => {
      const repo = createPaymentsRepository(tx);
      const payment = await repo.insert({
        bookingId,
        providerProfileId,
        provider: provider.name,
        status: 'pending',
        serviceAmount: breakdown.serviceAmount,
        commissionBasisPoints,
        commissionAmount: breakdown.commissionAmount,
        providerEarningAmount: breakdown.providerEarningAmount,
        currency: 'LKR',
        externalReference: `SM-${randomUUID()}`,
      });
      await repo.insertLedgerEntry({
        paymentId: payment.id,
        kind: 'created',
        status: payment.status,
        serviceAmount: payment.serviceAmount,
        commissionAmount: payment.commissionAmount,
        gatewayFeeAmount: payment.gatewayFeeAmount,
        providerEarningAmount: payment.providerEarningAmount,
        externalReference: payment.externalReference,
        providerPaymentId: payment.providerPaymentId,
        note: 'Payment created on booking completion.',
      });
      return payment;
    });
  }

  /**
   * Ensures a completed booking has AT LEAST ONE payment row, whatever its
   * status, creating one only if none exists yet at all. Used by the
   * completion hook and as a read-side fallback (self-healing if that hook
   * did not run or failed) — never as a retry trigger: a failed/cancelled
   * payment is left exactly as it is, so a viewer can actually see that it
   * failed instead of a silent new attempt appearing behind them. Starting a
   * fresh attempt after a failure is `ensureActivePaymentForCheckout`'s job,
   * triggered only by an explicit checkout action.
   */
  async function getOrCreatePaymentForBooking(bookingId: string): Promise<Payment> {
    const [mostRecent] = await repository.listForBooking(bookingId);
    if (mostRecent) return mostRecent;
    return createPaymentRow(bookingId);
  }

  /**
   * Ensures a `pending`/`succeeded` ("active") payment exists, starting a
   * fresh attempt if the most recent one failed, was cancelled, or was
   * refunded (a retry), or if none exists yet. This is checkout's own entry
   * point specifically because starting a new attempt is a real, visible
   * action — never an implicit side effect of merely viewing a payment.
   */
  async function ensureActivePaymentForCheckout(bookingId: string): Promise<Payment> {
    const active = await repository.findActiveForBooking(bookingId);
    if (active) return active;
    return createPaymentRow(bookingId);
  }

  async function requireBookingParty(userId: string, bookingId: string) {
    const context = await repository.findBookingContext(bookingId);
    if (!context) throw notFound('Booking not found.');
    const isParty = context.customerId === userId; // provider-side authorization checked by caller via findProviderProfileId, see getForViewer
    return { context, isParty };
  }

  return {
    /**
     * Triggered by `bookings.service.ts` right after a booking completes.
     * Failures are logged by the caller and never block completion itself —
     * `getPaymentForViewer` self-heals by calling
     * {@link getOrCreatePaymentForBooking} again on next access.
     */
    createPaymentForCompletedBooking: getOrCreatePaymentForBooking,

    /** The customer starts (or resumes/retries) paying for their completed booking. */
    async createCheckoutSession(userId: string, bookingId: string): Promise<CheckoutSession> {
      const { context, isParty } = await requireBookingParty(userId, bookingId);
      if (!isParty) throw notFound('Booking not found.');

      const payment = await ensureActivePaymentForCheckout(bookingId);
      if (payment.status === 'succeeded') {
        throw paymentAlreadyFinal('This booking has already been paid.');
      }

      const nameParts = (context.customerFullName ?? '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? 'Customer';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;
      return provider.createCheckout({
        orderId: payment.externalReference,
        amount: payment.serviceAmount,
        currency: payment.currency,
        itemDescription: `Service Marketplace booking ${bookingId}`,
        customer: {
          firstName,
          lastName,
          // This app authenticates by phone only and does not collect email today;
          // the gateway requires the field syntactically. Collecting a real
          // billing email is a follow-up, not modelled yet.
          email: `${context.customerPhone.replace(/[^0-9]/g, '')}@customer.invalid`,
          phone: context.customerPhone,
          address: context.serviceAddress,
          city: context.cityName,
          country: 'Sri Lanka',
        },
        returnUrl: `${publicApiBaseUrl}/api/payments/return`,
        cancelUrl: `${publicApiBaseUrl}/api/payments/cancel`,
        notifyUrl: `${publicApiBaseUrl}/api/payments/webhook`,
      });
    },

    /** The booking's customer or its assigned provider views the current payment state. */
    async getPaymentForViewer(
      userId: string,
      bookingId: string,
      findProviderProfileId: (userId: string) => Promise<string | undefined>,
    ): Promise<PaymentView | undefined> {
      const context = await repository.findBookingContext(bookingId);
      if (!context) throw notFound('Booking not found.');

      const isCustomer = context.customerId === userId;
      const isAssignedProvider =
        !isCustomer && (await findProviderProfileId(userId)) === context.providerProfileId;
      if (!isCustomer && !isAssignedProvider) throw notFound('Booking not found.');

      if (context.status !== 'completed') return undefined;
      const payment = await getOrCreatePaymentForBooking(bookingId);
      return toPaymentView(payment);
    },

    /**
     * A gateway (or, in mock mode, a test) reports a payment outcome.
     * Verifies the callback's signature first — an unverifiable callback is
     * rejected outright, never applied. Idempotent: a callback that arrives
     * after the payment has already left `pending` (a duplicate delivery, or
     * a lost race against another concurrent callback) is logged to the
     * ledger and otherwise ignored, never re-applied.
     */
    async handleCallback(rawPayload: Record<string, unknown>): Promise<void> {
      const verified = provider.verifyCallback(rawPayload);
      if (!verified) throw invalidCallback();

      const payment = await repository.findByExternalReference(verified.orderId);
      if (!payment) throw invalidCallback();

      // The server's own stored amount is authoritative; a gateway-reported
      // amount that disagrees with it is treated as suspicious, not applied.
      if (Number(verified.amount) !== Number(payment.serviceAmount)) {
        throw invalidCallback();
      }

      if (payment.status !== 'pending') {
        // Duplicate delivery (or we lost a race to another callback for the
        // same payment) — log it, never re-apply a financial side effect.
        await repository.insertLedgerEntry({
          paymentId: payment.id,
          kind: 'duplicate_ignored',
          status: payment.status,
          serviceAmount: payment.serviceAmount,
          commissionAmount: payment.commissionAmount,
          gatewayFeeAmount: payment.gatewayFeeAmount,
          providerEarningAmount: payment.providerEarningAmount,
          externalReference: payment.externalReference,
          providerPaymentId: verified.providerPaymentId,
          rawPayload: verified.raw,
          note: `Duplicate or already-settled callback ignored (payment already ${payment.status}).`,
        });
        return;
      }

      if (verified.status === 'pending') return; // Nothing changed; not worth a ledger entry.

      const now = clock();
      const newStatus = verified.status;
      // The status transition and its ledger entry land together: a crash
      // between them must never leave a payment marked succeeded/failed with
      // no matching audit trail for that event.
      const updated = await db.transaction(async (tx) => {
        const repo = createPaymentsRepository(tx);
        const result =
          newStatus === 'succeeded'
            ? await repo.markSucceeded(payment.id, {
                providerPaymentId: verified.providerPaymentId,
                succeededAt: now,
              })
            : newStatus === 'failed'
              ? await repo.markFailed(payment.id, {
                  providerPaymentId: verified.providerPaymentId,
                  failedAt: now,
                })
              : await repo.markCancelled(payment.id, {
                  providerPaymentId: verified.providerPaymentId,
                  cancelledAt: now,
                });

        if (!result) {
          // Lost a race to a concurrent callback between the read above and this write.
          await repo.insertLedgerEntry({
            paymentId: payment.id,
            kind: 'duplicate_ignored',
            status: payment.status,
            serviceAmount: payment.serviceAmount,
            commissionAmount: payment.commissionAmount,
            gatewayFeeAmount: payment.gatewayFeeAmount,
            providerEarningAmount: payment.providerEarningAmount,
            externalReference: payment.externalReference,
            providerPaymentId: verified.providerPaymentId,
            rawPayload: verified.raw,
            note: 'Concurrent callback lost a race; ignored.',
          });
          return undefined;
        }

        await repo.insertLedgerEntry({
          paymentId: result.id,
          kind: newStatus,
          status: result.status,
          serviceAmount: result.serviceAmount,
          commissionAmount: result.commissionAmount,
          gatewayFeeAmount: result.gatewayFeeAmount,
          providerEarningAmount: result.providerEarningAmount,
          externalReference: result.externalReference,
          providerPaymentId: result.providerPaymentId,
          rawPayload: verified.raw,
        });
        return result;
      });

      if (!updated) return;

      if (verified.status === 'succeeded' || verified.status === 'failed') {
        const context = await repository.findBookingContext(updated.bookingId);
        await notify(
          verified.status === 'succeeded' ? 'payment_succeeded' : 'payment_failed',
          context?.customerId,
          {
            bookingId: updated.bookingId,
            paymentId: updated.id,
            amount: updated.serviceAmount,
            currency: updated.currency,
          },
        );
      }
    },

    /**
     * Refunds a succeeded payment. NOT reachable over HTTP: see the module
     * doc comment. A payment already swept into a payout cannot be refunded
     * here — that payout has (or may have) already been paid out, and
     * reconciling money already sent is out of scope for V1.
     */
    async refundPayment(paymentId: string, reason: string): Promise<PaymentView> {
      const payment = await repository.findById(paymentId);
      if (!payment) throw notFound('Payment not found.');
      if (payment.status !== 'succeeded') {
        throw paymentAlreadyFinal(
          `A payment can only be refunded from "succeeded", not "${payment.status}".`,
        );
      }
      if (payment.payoutId !== null) {
        throw paymentAlreadyFinal(
          'This payment has already been included in a payout and cannot be refunded here.',
        );
      }
      if (!payment.providerPaymentId) {
        throw paymentAlreadyFinal('This payment has no gateway reference to refund.');
      }

      // The gateway call cannot be part of the DB transaction below (it's an
      // external HTTP call), so a crash between it succeeding and the write
      // below committing would leave this payment looking un-refunded, and a
      // retry would call the gateway a second time. Not a live risk today —
      // `PayHereProvider.refund` is not actually wired to PayHere's Refund
      // API yet and always rejects (see its own doc comment); only the mock
      // provider used in dev/test can reach this point. Revisit with a
      // gateway-side idempotency key once a real refund integration exists.
      await provider.refund({
        providerPaymentId: payment.providerPaymentId,
        amount: payment.serviceAmount,
        currency: payment.currency,
        reason,
      });

      const refunded = await db.transaction(async (tx) => {
        const repo = createPaymentsRepository(tx);
        const result = await repo.markRefunded(paymentId, clock());
        if (!result) {
          throw paymentAlreadyFinal(
            'This payment changed state while the refund was being processed.',
          );
        }
        await repo.insertLedgerEntry({
          paymentId: result.id,
          kind: 'refunded',
          status: result.status,
          serviceAmount: result.serviceAmount,
          commissionAmount: result.commissionAmount,
          gatewayFeeAmount: result.gatewayFeeAmount,
          providerEarningAmount: result.providerEarningAmount,
          externalReference: result.externalReference,
          providerPaymentId: result.providerPaymentId,
          note: reason,
        });
        return result;
      });
      return toPaymentView(refunded);
    },

    /**
     * Computes each provider's payable amount for `[periodStart, periodEnd)`
     * from that period's succeeded, not-yet-paid-out payments, and records
     * one payout row per provider. Idempotent per provider/period (backed by
     * the `provider_payouts_provider_period_uidx` unique index): a provider
     * who already has a payout for this exact period gets that SAME row back
     * unchanged, never recomputed — once calculated, a payout is final. This
     * is why existing payouts are looked up as a whole separately from
     * {@link summarizeSucceededPaymentsForPeriod}: a payment already swept
     * into a payout no longer appears in that summary at all (by design — see
     * its own doc comment), so on a recompute it alone cannot distinguish "no
     * activity this period" from "already paid out"; the period's existing
     * payouts, queried directly, can. NOT a cron; there is no scheduler in
     * this codebase (see the bookings module's doc comment). Run manually via
     * `npm run dev:payouts`.
     */
    async calculatePayoutsForPeriod(periodStart: Date, periodEnd: Date): Promise<PayoutView[]> {
      const existingPayouts = await repository.listPayoutsForPeriod(periodStart, periodEnd);
      const existingProviderIds = new Set(existingPayouts.map((p) => p.providerProfileId));
      const totals = await repository.summarizeSucceededPaymentsForPeriod(periodStart, periodEnd);

      const results: ProviderPayout[] = [...existingPayouts];
      for (const total of totals) {
        // Should never happen (an unassigned payment implies no payout yet
        // for its provider/period), but skip rather than violate the unique
        // index if it somehow did.
        if (existingProviderIds.has(total.providerProfileId)) continue;

        // One transaction per provider: inserting the payout row and
        // stamping its payments with `payoutId` must land together. Without
        // this, a crash between the two would leave a payout row that looks
        // final (this function's own idempotency check skips any provider
        // who already has one for the period) while its payments are never
        // marked as swept into it — silently unpayable, forever, with no
        // error surfaced anywhere.
        const payout = await db.transaction(async (tx) => {
          const repo = createPaymentsRepository(tx);
          const inserted = await repo.insertPayout({
            providerProfileId: total.providerProfileId,
            periodStart,
            periodEnd,
            totalServiceAmount: total.totalServiceAmount,
            totalCommissionAmount: total.totalCommissionAmount,
            totalGatewayFeeAmount: total.totalGatewayFeeAmount,
            totalProviderEarningAmount: total.totalProviderEarningAmount,
            paymentCount: total.paymentCount,
            status: 'pending',
          });
          await repo.assignToPayout(total.paymentIds, inserted.id);
          return inserted;
        });
        results.push(payout);
      }
      return results.map(toPayoutView);
    },

    /** Marks a payout as paid. The actual bank transfer is a manual, out-of-band step; this just records that it happened. NOT reachable over HTTP: see the module doc comment. */
    async markPayoutPaid(payoutId: string, note: string | null): Promise<PayoutView> {
      const payout = await repository.markPayoutPaid(payoutId, clock(), note);
      if (payout) {
        const recipientUserId = findProviderUserId
          ? await findProviderUserId(payout.providerProfileId)
          : undefined;
        await notify('payout_paid', recipientUserId, {
          payoutId: payout.id,
          amount: payout.totalProviderEarningAmount,
          currency: 'LKR',
        });
        return toPayoutView(payout);
      }

      const existing = await repository.findPayoutById(payoutId);
      if (!existing) throw notFound('Payout not found.');
      throw paymentAlreadyFinal(
        `A payout can only be marked paid from "pending", not "${existing.status}".`,
      );
    },

    async listPayoutsForProvider(providerProfileId: string): Promise<PayoutView[]> {
      return (await repository.listPayoutsForProvider(providerProfileId)).map(toPayoutView);
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
export type { PaymentsRepository };
