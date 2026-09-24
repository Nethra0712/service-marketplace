import { eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  bookings,
  payments,
  providerPayouts,
  providerProfiles,
  providerServices,
  reviews,
  users,
} from '../../db/schema/index.js';

export interface DashboardMetrics {
  users: { total: number; providers: number; suspended: number };
  bookings: { total: number; byStatus: Record<string, number>; completed: number };
  revenue: { serviceAmount: string; commissionAmount: string; providerEarningAmount: string };
  payouts: { pendingCount: number; pendingAmount: string; paidCount: number; paidAmount: string };
  providers: { total: number; verified: number; pendingApplications: number };
  reviews: { total: number; averageRating: number | null };
}

const ZERO = '0.00';

/** Operational metrics for the dashboard landing page. Every figure is a live aggregate — nothing here is cached or pre-computed. */
export function createDashboardService({ db }: { db: Database }) {
  return {
    async getMetrics(): Promise<DashboardMetrics> {
      const [
        userCounts,
        providerCount,
        bookingStatusCounts,
        revenueRow,
        payoutRows,
        providerStatusCounts,
        pendingApplicationsRow,
        reviewRow,
      ] = await Promise.all([
        db
          .select({
            total: sql<number>`count(*) filter (where ${users.deletedAt} is null)::int`,
            suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended' and ${users.deletedAt} is null)::int`,
          })
          .from(users),
        db
          .select({ count: sql<number>`count(distinct ${providerProfiles.userId})::int` })
          .from(providerProfiles),
        db
          .select({ status: bookings.status, count: sql<number>`count(*)::int` })
          .from(bookings)
          .groupBy(bookings.status),
        db
          .select({
            serviceAmount: sql<string>`coalesce(sum(${payments.serviceAmount}), 0)`,
            commissionAmount: sql<string>`coalesce(sum(${payments.commissionAmount}), 0)`,
            providerEarningAmount: sql<string>`coalesce(sum(${payments.providerEarningAmount}), 0)`,
          })
          .from(payments)
          .where(eq(payments.status, 'succeeded')),
        db
          .select({
            status: providerPayouts.status,
            count: sql<number>`count(*)::int`,
            amount: sql<string>`coalesce(sum(${providerPayouts.totalProviderEarningAmount}), 0)`,
          })
          .from(providerPayouts)
          .groupBy(providerPayouts.status),
        db
          .select({
            verified: sql<number>`count(*) filter (where ${providerProfiles.verificationStatus} = 'verified')::int`,
          })
          .from(providerProfiles),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(providerServices)
          .where(eq(providerServices.status, 'pending')),
        db
          .select({
            total: sql<number>`count(*)::int`,
            averageRating: sql<string | null>`avg(${reviews.rating})`,
          })
          .from(reviews)
          .where(isNull(reviews.hiddenAt)),
      ]);

      const byStatus: Record<string, number> = {};
      let bookingTotal = 0;
      for (const row of bookingStatusCounts) {
        byStatus[row.status] = row.count;
        bookingTotal += row.count;
      }

      const pending = payoutRows.find((r) => r.status === 'pending');
      const paid = payoutRows.find((r) => r.status === 'paid');

      return {
        users: {
          total: userCounts[0]?.total ?? 0,
          providers: providerCount[0]?.count ?? 0,
          suspended: userCounts[0]?.suspended ?? 0,
        },
        bookings: { total: bookingTotal, byStatus, completed: byStatus.completed ?? 0 },
        revenue: {
          serviceAmount: revenueRow[0]?.serviceAmount ?? ZERO,
          commissionAmount: revenueRow[0]?.commissionAmount ?? ZERO,
          providerEarningAmount: revenueRow[0]?.providerEarningAmount ?? ZERO,
        },
        payouts: {
          pendingCount: pending?.count ?? 0,
          pendingAmount: pending?.amount ?? ZERO,
          paidCount: paid?.count ?? 0,
          paidAmount: paid?.amount ?? ZERO,
        },
        providers: {
          total: providerCount[0]?.count ?? 0,
          verified: providerStatusCounts[0]?.verified ?? 0,
          pendingApplications: pendingApplicationsRow[0]?.count ?? 0,
        },
        reviews: {
          total: reviewRow[0]?.total ?? 0,
          averageRating:
            reviewRow[0]?.averageRating == null ? null : Number(reviewRow[0].averageRating),
        },
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
