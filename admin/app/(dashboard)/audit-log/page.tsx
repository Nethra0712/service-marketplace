'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, titleCase } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

const ACTIONS = [
  'provider_application_reviewed',
  'provider_profile_reviewed',
  'user_suspended',
  'user_reactivated',
  'category_created',
  'category_updated',
  'payment_refunded',
  'payout_marked_paid',
  'review_hidden',
] as const;

interface AuditLogEntry {
  id: string;
  adminUserId: string;
  action: (typeof ACTIONS)[number];
  targetType: string;
  targetId: string;
  details: unknown;
  createdAt: string;
}

export default function AuditLogPage() {
  const [action, setAction] = useState<(typeof ACTIONS)[number] | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    return api.get<{ items: AuditLogEntry[] }>(`/api/admin/audit-log?${params.toString()}`);
  }, [action]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500">
          A permanent, append-only record of every sensitive admin action. Nothing here can be
          edited or deleted.
        </p>
      </div>

      <Select
        value={action}
        onChange={(e) => setAction(e.target.value as (typeof ACTIONS)[number] | '')}
      >
        <option value="">All actions</option>
        {ACTIONS.map((a) => (
          <option key={a} value={a}>
            {titleCase(a)}
          </option>
        ))}
      </Select>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No audit log entries match this filter." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Details</Th>
                  <Th>Admin</Th>
                  <Th>When</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="font-medium text-slate-900">{titleCase(entry.action)}</Td>
                    <Td>
                      {titleCase(entry.targetType)}{' '}
                      <span className="text-xs text-slate-400">{entry.targetId}</span>
                    </Td>
                    <Td className="max-w-xs truncate font-mono text-xs">
                      {entry.details ? JSON.stringify(entry.details) : '—'}
                    </Td>
                    <Td className="text-xs text-slate-500">{entry.adminUserId}</Td>
                    <Td>{formatDate(entry.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
