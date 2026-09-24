'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';

interface UserDetail {
  id: string;
  phoneE164: string;
  fullName: string | null;
  status: 'active' | 'suspended';
  isProvider: boolean;
  createdAt: string;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => api.get<UserDetail>(`/api/admin/users/${id}`), [id]);
  const result = useApi(fetcher);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suspend() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/admin/users/${id}/suspend`, { reason });
      setReason('');
      result.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not suspend user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function reactivate() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/admin/users/${id}/reactivate`);
      result.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reactivate user.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result.status === 'loading') return <LoadingState />;
  if (result.status === 'error') return <ErrorState error={result.error} onRetry={result.reload} />;

  const u = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{u.fullName ?? '(no name)'}</h1>
        <Badge tone={u.status === 'active' ? 'good' : 'bad'}>
          {u.status === 'active' ? 'Active' : 'Suspended'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Phone</dt>
              <dd className="mt-0.5 text-sm text-slate-900">{u.phoneE164}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Role</dt>
              <dd className="mt-0.5 text-sm text-slate-900">
                {u.isProvider ? 'Provider' : 'Customer'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase">Joined</dt>
              <dd className="mt-0.5 text-sm text-slate-900">{formatDate(u.createdAt)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {u.status === 'active' ? (
            <>
              <div>
                <Label htmlFor="reason">Suspension reason</Label>
                <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <Button
                variant="danger"
                disabled={submitting || !reason.trim()}
                onClick={() => void suspend()}
              >
                {submitting ? 'Suspending…' : 'Suspend user'}
              </Button>
            </>
          ) : (
            <Button disabled={submitting} onClick={() => void reactivate()}>
              {submitting ? 'Reactivating…' : 'Reactivate user'}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
