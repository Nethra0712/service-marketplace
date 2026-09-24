'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, formatMoney, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

const STATUSES = ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'] as const;
type PaymentStatus = (typeof STATUSES)[number];

interface PaymentRow {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  serviceAmount: string;
  commissionAmount: string;
  providerEarningAmount: string;
  currency: string;
  customerName: string | null;
  providerName: string | null;
  createdAt: string;
  succeededAt: string | null;
}

const STATUS_TONE: Record<PaymentStatus, 'neutral' | 'good' | 'bad' | 'warn'> = {
  pending: 'warn',
  succeeded: 'good',
  failed: 'bad',
  cancelled: 'neutral',
  refunded: 'bad',
};

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return api.get<{ items: PaymentRow[] }>(`/api/admin/payments?${params.toString()}`);
  }, [search, status]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Payments</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by customer, phone, or reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No payments match these filters." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Customer</Th>
                  <Th>Provider</Th>
                  <Th>Service amount</Th>
                  <Th>Commission</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/payments/${p.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {p.customerName ?? '(unknown)'}
                      </Link>
                    </Td>
                    <Td>{p.providerName ?? '—'}</Td>
                    <Td>{formatMoney(p.serviceAmount)}</Td>
                    <Td>{formatMoney(p.commissionAmount)}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[p.status]}>{titleCase(p.status)}</Badge>
                    </Td>
                    <Td>{formatDate(p.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
