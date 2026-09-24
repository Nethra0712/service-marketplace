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

const STATUSES = [
  'searching',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
] as const;
type BookingStatus = (typeof STATUSES)[number];

interface BookingRow {
  id: string;
  status: BookingStatus;
  categoryName: string;
  cityName: string;
  customerName: string | null;
  customerPhone: string;
  providerName: string | null;
  agreedAmount: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<BookingStatus, 'neutral' | 'good' | 'bad' | 'warn'> = {
  searching: 'neutral',
  accepted: 'warn',
  en_route: 'warn',
  arrived: 'warn',
  in_progress: 'warn',
  completed: 'good',
  cancelled: 'bad',
  expired: 'bad',
};

export default function BookingsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return api.get<{ items: BookingRow[] }>(`/api/admin/bookings?${params.toString()}`);
  }, [search, status]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Bookings</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by customer or provider…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | '')}>
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
            <EmptyState message="No bookings match these filters." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Category</Th>
                  <Th>City</Th>
                  <Th>Customer</Th>
                  <Th>Provider</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((b) => (
                  <Tr key={b.id}>
                    <Td>
                      <Link
                        href={`/bookings/${b.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {b.categoryName}
                      </Link>
                    </Td>
                    <Td>{b.cityName}</Td>
                    <Td>{b.customerName ?? b.customerPhone}</Td>
                    <Td>{b.providerName ?? '—'}</Td>
                    <Td>{b.agreedAmount ? formatMoney(b.agreedAmount) : '—'}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[b.status]}>{titleCase(b.status)}</Badge>
                    </Td>
                    <Td>{formatDate(b.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
