import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  bookings,
  paymentLedgerEntries,
  payments,
  profiles,
  providerProfiles,
  users,
  type PaymentStatus,
} from '../../db/schema/index.js';
import type { PaymentsService, PaymentView } from '../../modules/payments/index.js';
import type { AuditLogService } from './audit-log.service.js';

const customerProfile = alias(profiles, 'payment_customer_profile');
const providerAccountProfile = alias(profiles, 'payment_provider_profile');

export interface AdminPaymentRow {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  serviceAmount: string;
  commissionAmount: string;
  providerEarningAmount: string;
  currency: string;
  customerName: string | null;
  providerName: string | null;
  createdAt: Date;
  succeededAt: Date | null;
}

export interface AdminLedgerEntryRow {
  id: string;
  kind: string;
  status: PaymentStatus;
  providerPaymentId: string | null;
  note: string | null;
  createdAt: Date;
}

function summaryQuery(db: Database) {
  return db
    .select({
      id: payments.id,
      bookingId: payments.bookingId,
      status: payments.status,
      serviceAmount: payments.serviceAmount,
      commissionAmount: payments.commissionAmount,
      providerEarningAmount: payments.providerEarningAmount,
      currency: payments.currency,
      customerName: customerProfile.fullName,
      providerName: providerAccountProfile.fullName,
      createdAt: payments.createdAt,
      succeededAt: payments.succeededAt,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .leftJoin(customerProfile, eq(customerProfile.userId, bookings.customerId))
    .innerJoin(providerProfiles, eq(providerProfiles.id, payments.providerProfileId))
    .leftJoin(providerAccountProfile, eq(providerAccountProfile.userId, providerProfiles.userId));
}

export interface AdminPaymentFilter {
  status?: PaymentStatus | undefined;
  search?: string | undefined;
  limit: number;
}

export interface AdminPaymentsServiceDeps {
  db: Database;
  payments: PaymentsService;
  audit: AuditLogService;
}

/** Admin visibility into payments, plus refunds (delegated to `payments.service.ts`'s existing, already-tested `refundPayment`). */
export function createAdminPaymentsService({
  db,
  payments: paymentsService,
  audit,
}: AdminPaymentsServiceDeps) {
  return {
    async list(filter: AdminPaymentFilter): Promise<AdminPaymentRow[]> {
      const conditions = [
        filter.status ? eq(payments.status, filter.status) : undefined,
        filter.search
          ? or(
              ilike(customerProfile.fullName, `%${filter.search}%`),
              ilike(users.phoneE164, `%${filter.search}%`),
              eq(payments.externalReference, filter.search),
            )
          : undefined,
      ].filter((c) => c !== undefined);

      return summaryQuery(db)
        .leftJoin(users, eq(users.id, bookings.customerId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(payments.createdAt))
        .limit(filter.limit);
    },

    async getDetail(id: string): Promise<
      | {
          payment: AdminPaymentRow & {
            externalReference: string;
            providerPaymentId: string | null;
          };
          ledger: AdminLedgerEntryRow[];
        }
      | undefined
    > {
      const [row] = await summaryQuery(db).where(eq(payments.id, id));
      if (!row) return undefined;
      const [[full], ledger] = await Promise.all([
        db.select().from(payments).where(eq(payments.id, id)),
        db
          .select({
            id: paymentLedgerEntries.id,
            kind: paymentLedgerEntries.kind,
            status: paymentLedgerEntries.status,
            providerPaymentId: paymentLedgerEntries.providerPaymentId,
            note: paymentLedgerEntries.note,
            createdAt: paymentLedgerEntries.createdAt,
          })
          .from(paymentLedgerEntries)
          .where(eq(paymentLedgerEntries.paymentId, id))
          .orderBy(paymentLedgerEntries.createdAt),
      ]);
      if (!full) return undefined;

      return {
        payment: {
          ...row,
          externalReference: full.externalReference,
          providerPaymentId: full.providerPaymentId,
        },
        ledger,
      };
    },

    async refund(adminUserId: string, id: string, reason: string): Promise<PaymentView> {
      const refunded = await paymentsService.refundPayment(id, reason);
      await audit.record({
        adminUserId,
        action: 'payment_refunded',
        targetType: 'payment',
        targetId: id,
        details: { reason },
      });
      return refunded;
    },
  };
}

export type AdminPaymentsService = ReturnType<typeof createAdminPaymentsService>;
