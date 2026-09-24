'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, formatMoney, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

type PayoutStatus = 'pending' | 'paid' | 'cancelled';

interface PayoutRow {
  id: string;
  providerProfileId: string;
  providerName: string | null;
  periodStart: string;
  periodEnd: string;
  totalServiceAmount: string;
  totalCommissionAmount: string;
  totalGatewayFeeAmount: string;
  totalProviderEarningAmount: string;
  paymentCount: number;
  status: PayoutStatus;
  paidAt: string | null;
}

function CalculatePanel({ onCalculated }: { onCalculated: () => void }) {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  async function calculate() {
    setSubmitting(true);
    setError(null);
    setCreatedCount(null);
    try {
      const { items } = await api.post<{ items: unknown[] }>('/api/admin/payouts/calculate', {
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });
      setCreatedCount(items.length);
      onCalculated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not calculate payouts.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculate payouts for a period</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="periodStart">
              Period start
            </label>
            <Input
              id="periodStart"
              type="datetime-local"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="periodEnd">
              Period end
            </label>
            <Input
              id="periodEnd"
              type="datetime-local"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <Button
            disabled={submitting || !periodStart || !periodEnd}
            onClick={() => void calculate()}
          >
            {submitting ? 'Calculating…' : 'Calculate'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {createdCount !== null && (
          <p className="text-sm text-slate-500">{createdCount} payout(s) in this period.</p>
        )}
      </CardBody>
    </Card>
  );
}

function MarkPaidButton({ payoutId, onDone }: { payoutId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/admin/payouts/${payoutId}/mark-paid`, { note: note || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark payout as paid.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Mark paid
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        className="w-40"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button disabled={submitting} onClick={() => void markPaid()}>
        Confirm
      </Button>
      <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

export default function PayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return api.get<{ items: PayoutRow[] }>(`/api/admin/payouts?${params.toString()}`);
  }, [status]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Payouts</h1>

      <CalculatePanel onCalculated={result.reload} />

      <Select value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus | '')}>
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No payouts match this filter." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Provider</Th>
                  <Th>Period</Th>
                  <Th>Payments</Th>
                  <Th>Provider earning</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((p) => (
                  <Tr key={p.id}>
                    <Td>{p.providerName ?? '—'}</Td>
                    <Td>
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                    </Td>
                    <Td>{p.paymentCount}</Td>
                    <Td>{formatMoney(p.totalProviderEarningAmount)}</Td>
                    <Td>
                      <Badge
                        tone={
                          p.status === 'paid' ? 'good' : p.status === 'cancelled' ? 'bad' : 'warn'
                        }
                      >
                        {titleCase(p.status)}
                      </Badge>
                    </Td>
                    <Td>
                      {p.status === 'pending' ? (
                        <MarkPaidButton payoutId={p.id} onDone={result.reload} />
                      ) : (
                        p.paidAt && (
                          <span className="text-xs text-slate-500">{formatDate(p.paidAt)}</span>
                        )
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
