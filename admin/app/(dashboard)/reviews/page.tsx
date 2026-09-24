'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

interface ReviewRow {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  authorUserId: string;
  authorName: string | null;
  targetUserId: string;
  targetName: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
}

function HideButton({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hide() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/admin/reviews/${reviewId}/hide`, { reason: reason || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not hide review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Hide
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        className="w-40"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button variant="danger" disabled={submitting} onClick={() => void hide()}>
        Confirm
      </Button>
      <Button variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

export default function ReviewsPage() {
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<'true' | 'false' | ''>('');

  const fetcher = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (hidden) params.set('hidden', hidden);
    return api.get<{ items: ReviewRow[] }>(`/api/admin/reviews?${params.toString()}`);
  }, [search, hidden]);
  const result = useApi(fetcher);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Reviews</h1>
      <p className="text-sm text-slate-500">
        Hiding removes a review from public ratings without altering its rating or comment.
      </p>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by author or target name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={hidden} onChange={(e) => setHidden(e.target.value as 'true' | 'false' | '')}>
          <option value="">All reviews</option>
          <option value="false">Visible only</option>
          <option value="true">Hidden only</option>
        </Select>
      </div>

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No reviews match these filters." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Author</Th>
                  <Th>Target</Th>
                  <Th>Rating</Th>
                  <Th>Comment</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.authorName ?? '(unknown)'}</Td>
                    <Td>{r.targetName ?? '(unknown)'}</Td>
                    <Td>{r.rating} / 5</Td>
                    <Td className="max-w-xs truncate">{r.comment ?? '—'}</Td>
                    <Td>
                      {r.hiddenAt ? (
                        <Badge tone="bad">
                          Hidden{r.hiddenReason ? `: ${r.hiddenReason}` : ''}
                        </Badge>
                      ) : (
                        <Badge tone="good">Visible</Badge>
                      )}
                    </Td>
                    <Td>{formatDate(r.createdAt)}</Td>
                    <Td>{!r.hiddenAt && <HideButton reviewId={r.id} onDone={result.reload} />}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
