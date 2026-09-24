'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

type UserStatus = 'active' | 'suspended';

interface UserRow {
  id: string;
  phoneE164: string;
  fullName: string | null;
  status: UserStatus;
  isProvider: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return api.get<{ items: UserRow[] }>(`/api/admin/users?${params.toString()}`);
  }, [search, status]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Users</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | '')}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No users match these filters." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <Link
                        href={`/users/${u.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {u.fullName ?? '(no name)'}
                      </Link>
                    </Td>
                    <Td>{u.phoneE164}</Td>
                    <Td>{u.isProvider ? 'Provider' : 'Customer'}</Td>
                    <Td>
                      <Badge tone={u.status === 'active' ? 'good' : 'bad'}>
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </Td>
                    <Td>{formatDate(u.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
