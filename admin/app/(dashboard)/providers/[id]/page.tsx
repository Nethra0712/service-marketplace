'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { ErrorState, LoadingState } from '@/components/ui/states';

interface ProviderDetail {
  provider: {
    id: string;
    userId: string;
    fullName: string | null;
    phoneE164: string;
    verificationStatus: 'draft' | 'submitted' | 'verified' | 'rejected';
    submittedAt: string | null;
    createdAt: string;
  };
  applications: {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'suspended';
    reviewNote: string | null;
    categoryName: string;
    createdAt: string;
  }[];
}

const APP_TONE: Record<string, 'neutral' | 'good' | 'bad' | 'warn'> = {
  pending: 'warn',
  approved: 'good',
  rejected: 'bad',
  suspended: 'bad',
};
const PROFILE_TONE: Record<string, 'neutral' | 'good' | 'bad' | 'warn'> = {
  draft: 'neutral',
  submitted: 'warn',
  verified: 'good',
  rejected: 'bad',
};

export default function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => api.get<ProviderDetail>(`/api/admin/providers/${id}`), [id]);
  const result = useApi(fetcher);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reviewProfile(decision: 'verified' | 'rejected') {
    setBusy('profile');
    setActionError(null);
    try {
      await api.post(`/api/admin/providers/${id}/profile/review`, {
        decision,
        note: note || undefined,
      });
      result.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  async function reviewApplication(
    applicationId: string,
    decision: 'approved' | 'rejected' | 'suspended',
  ) {
    setBusy(applicationId);
    setActionError(null);
    try {
      await api.post(`/api/admin/providers/${id}/applications/${applicationId}/review`, {
        decision,
        note: note || undefined,
      });
      result.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  }

  if (result.status === 'loading') return <LoadingState />;
  if (result.status === 'error') return <ErrorState error={result.error} onRetry={result.reload} />;

  const { provider, applications } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{provider.fullName ?? '(no name)'}</h1>
        <p className="text-sm text-slate-500">{provider.phoneE164}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone={PROFILE_TONE[provider.verificationStatus]}>
              {titleCase(provider.verificationStatus)}
            </Badge>
            <span className="text-xs text-slate-500">
              {provider.submittedAt
                ? `Submitted ${formatDate(provider.submittedAt)}`
                : 'Not yet submitted'}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="note">
              Note (applies to whichever action you take below)
            </label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          {actionError && <p className="text-sm text-red-700">{actionError}</p>}

          <div className="flex gap-2">
            <Button
              disabled={busy !== null || provider.verificationStatus !== 'submitted'}
              onClick={() => void reviewProfile('verified')}
            >
              Verify profile
            </Button>
            <Button
              variant="danger"
              disabled={busy !== null || provider.verificationStatus !== 'submitted'}
              onClick={() => void reviewProfile('rejected')}
            >
              Reject profile
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category applications</CardTitle>
        </CardHeader>
        <CardBody>
          {applications.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Review note</Th>
                  <Th>Applied</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {applications.map((a) => (
                  <Tr key={a.id}>
                    <Td>{a.categoryName}</Td>
                    <Td>
                      <Badge tone={APP_TONE[a.status]}>{titleCase(a.status)}</Badge>
                    </Td>
                    <Td className="max-w-xs truncate">{a.reviewNote ?? '—'}</Td>
                    <Td>{formatDate(a.createdAt)}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          disabled={busy !== null || a.status === 'approved'}
                          onClick={() => void reviewApplication(a.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy !== null || a.status === 'rejected'}
                          onClick={() => void reviewApplication(a.id, 'rejected')}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busy !== null || a.status === 'suspended'}
                          onClick={() => void reviewApplication(a.id, 'suspended')}
                        >
                          Suspend
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
