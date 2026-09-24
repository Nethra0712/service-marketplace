'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

type VerificationStatus = 'draft' | 'submitted' | 'verified' | 'rejected';

interface ProviderRow {
  id: string;
  userId: string;
  fullName: string | null;
  phoneE164: string;
  verificationStatus: VerificationStatus;
  submittedAt: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<VerificationStatus, 'neutral' | 'good' | 'bad' | 'warn'> = {
  draft: 'neutral',
  submitted: 'warn',
  verified: 'good',
  rejected: 'bad',
};

export default function ProvidersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VerificationStatus | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('verificationStatus', status);
    return api.get<{ items: ProviderRow[] }>(`/api/admin/providers?${params.toString()}`);
  }, [search, status]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Providers</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as VerificationStatus | '')}
        >
          <option value="">All verification statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No providers match these filters." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                  <Th>Submitted</Th>
                  <Th>Joined</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link
                        href={`/providers/${p.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {p.fullName ?? '(no name)'}
                      </Link>
                    </Td>
                    <Td>{p.phoneE164}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[p.verificationStatus]}>
                        {titleCase(p.verificationStatus)}
                      </Badge>
                    </Td>
                    <Td>{p.submittedAt ? formatDate(p.submittedAt) : '—'}</Td>
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
