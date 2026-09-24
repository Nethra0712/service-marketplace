'use client';

import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatMoney, titleCase } from '@/lib/format';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui/states';

interface DashboardMetrics {
  users: { total: number; providers: number; suspended: number };
  bookings: { total: number; byStatus: Record<string, number>; completed: number };
  revenue: { serviceAmount: string; commissionAmount: string; providerEarningAmount: string };
  payouts: { pendingCount: number; pendingAmount: string; paidCount: number; paidAmount: string };
  providers: { total: number; verified: number; pendingApplications: number };
  reviews: { total: number; averageRating: number | null };
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const fetcher = useCallback(() => api.get<DashboardMetrics>('/api/admin/dashboard'), []);
  const result = useApi(fetcher);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      {result.status === 'loading' && <LoadingState />}
      {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
      {result.status === 'success' && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Users &amp; providers</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Total users" value={result.data.users.total.toLocaleString()} />
              <Stat label="Suspended users" value={result.data.users.suspended.toLocaleString()} />
              <Stat label="Providers" value={result.data.providers.total.toLocaleString()} />
              <Stat
                label="Verified providers"
                value={result.data.providers.verified.toLocaleString()}
                hint={`${result.data.providers.pendingApplications.toString()} pending application(s)`}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Bookings</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Total bookings" value={result.data.bookings.total.toLocaleString()} />
              <Stat label="Completed" value={result.data.bookings.completed.toLocaleString()} />
              {Object.entries(result.data.bookings.byStatus)
                .filter(([status]) => status !== 'completed')
                .map(([status, count]) => (
                  <Stat key={status} label={titleCase(status)} value={count.toLocaleString()} />
                ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Revenue (succeeded payments)
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat
                label="Gross service amount"
                value={formatMoney(result.data.revenue.serviceAmount)}
              />
              <Stat label="Commission" value={formatMoney(result.data.revenue.commissionAmount)} />
              <Stat
                label="Provider earnings"
                value={formatMoney(result.data.revenue.providerEarningAmount)}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Payouts</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label="Pending"
                value={result.data.payouts.pendingCount.toLocaleString()}
                hint={formatMoney(result.data.payouts.pendingAmount)}
              />
              <Stat
                label="Paid"
                value={result.data.payouts.paidCount.toLocaleString()}
                hint={formatMoney(result.data.payouts.paidAmount)}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Reviews</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Total reviews" value={result.data.reviews.total.toLocaleString()} />
              <Stat
                label="Average rating"
                value={
                  result.data.reviews.averageRating == null
                    ? '—'
                    : result.data.reviews.averageRating.toFixed(2)
                }
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Note</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-500">
                Every figure above is a live aggregate computed on request — nothing on this page is
                cached.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
