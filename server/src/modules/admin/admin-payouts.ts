import { desc, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  profiles,
  providerPayouts,
  providerProfiles,
  type PayoutStatus,
} from '../../db/schema/index.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import type { PaymentsService, PayoutView } from '../../modules/payments/index.js';
import type { AuditLogService } from './audit-log.service.js';

export interface AdminPayoutRow extends PayoutView {
  providerName: string | null;
}

export interface AdminPayoutsServiceDeps {
  db: Database;
  payments: PaymentsService;
  audit: AuditLogService;
}

/** Admin payout visibility and the manual "mark paid" step — the actual bank transfer stays out-of-band (see `payments.service.ts`'s own doc comment). */
export function createAdminPayoutsService({ db, payments, audit }: AdminPayoutsServiceDeps) {
  return {
    async list(filter: {
      status?: PayoutStatus | undefined;
      limit: number;
    }): Promise<AdminPayoutRow[]> {
      const rows = await db
        .select({
          id: providerPayouts.id,
          providerProfileId: providerPayouts.providerProfileId,
          providerName: profiles.fullName,
          periodStart: providerPayouts.periodStart,
          periodEnd: providerPayouts.periodEnd,
          totalServiceAmount: providerPayouts.totalServiceAmount,
          totalCommissionAmount: providerPayouts.totalCommissionAmount,
          totalGatewayFeeAmount: providerPayouts.totalGatewayFeeAmount,
          totalProviderEarningAmount: providerPayouts.totalProviderEarningAmount,
          paymentCount: providerPayouts.paymentCount,
          status: providerPayouts.status,
          paidAt: providerPayouts.paidAt,
        })
        .from(providerPayouts)
        .innerJoin(providerProfiles, eq(providerProfiles.id, providerPayouts.providerProfileId))
        .leftJoin(profiles, eq(profiles.userId, providerProfiles.userId))
        .where(filter.status ? eq(providerPayouts.status, filter.status) : undefined)
        .orderBy(desc(providerPayouts.periodEnd))
        .limit(filter.limit);

      return rows.map((row) => ({
        ...row,
        periodStart: row.periodStart.toISOString(),
        periodEnd: row.periodEnd.toISOString(),
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      }));
    },

    async listForProvider(providerProfileId: string): Promise<PayoutView[]> {
      return payments.listPayoutsForProvider(providerProfileId);
    },

    /**
     * Not itself audit-logged: this only ever creates new `pending` payout
     * rows (idempotently — see `payments.service.ts`'s own doc comment) and
     * changes nothing existing, unlike every other action here, which has
     * one clear target row. Each payout it creates gets its own audit entry
     * the moment it is actually marked paid.
     */
    async calculate(periodStart: string, periodEnd: string): Promise<PayoutView[]> {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new AppError(400, ErrorCode.ValidationError, 'periodEnd must be after periodStart.');
      }
      return payments.calculatePayoutsForPeriod(start, end);
    },

    async markPaid(
      adminUserId: string,
      payoutId: string,
      note: string | null,
    ): Promise<PayoutView> {
      const result = await payments.markPayoutPaid(payoutId, note);
      await audit.record({
        adminUserId,
        action: 'payout_marked_paid',
        targetType: 'payout',
        targetId: payoutId,
        details: { note },
      });
      return result;
    },
  };
}

export type AdminPayoutsService = ReturnType<typeof createAdminPayoutsService>;
