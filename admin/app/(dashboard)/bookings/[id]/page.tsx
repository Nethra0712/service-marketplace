'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, formatMoney, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { ErrorState, LoadingState } from '@/components/ui/states';

interface BookingDetail {
  id: string;
  status: string;
  categoryName: string;
  cityName: string;
  customerName: string | null;
  customerPhone: string;
  providerName: string | null;
  agreedAmount: string | null;
  createdAt: string;
  scheduledAt: string | null;
  serviceAddress: string;
  customerNotes: string | null;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  offers: {
    id: string;
    providerProfileId: string;
    wave: number;
    status: string;
    offeredAt: string;
    respondedAt: string | null;
    distanceKm: string | null;
  }[];
  releases: { providerProfileId: string; reason: string | null; releasedAt: string }[];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => api.get<BookingDetail>(`/api/admin/bookings/${id}`), [id]);
  const result = useApi(fetcher);

  if (result.status === 'loading') return <LoadingState />;
  if (result.status === 'error') return <ErrorState error={result.error} onRetry={result.reload} />;

  const b = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{b.categoryName}</h1>
        <Badge tone="neutral">{titleCase(b.status)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Customer" value={b.customerName ?? b.customerPhone} />
            <Field label="Provider" value={b.providerName} />
            <Field label="City" value={b.cityName} />
            <Field label="Address" value={b.serviceAddress} />
            <Field
              label="Agreed amount"
              value={b.agreedAmount ? formatMoney(b.agreedAmount) : null}
            />
            <Field label="Scheduled" value={b.scheduledAt ? formatDate(b.scheduledAt) : null} />
            <Field label="Created" value={formatDate(b.createdAt)} />
            <Field label="Accepted" value={b.acceptedAt ? formatDate(b.acceptedAt) : null} />
            <Field label="En route" value={b.enRouteAt ? formatDate(b.enRouteAt) : null} />
            <Field label="Arrived" value={b.arrivedAt ? formatDate(b.arrivedAt) : null} />
            <Field
              label="Work started"
              value={b.workStartedAt ? formatDate(b.workStartedAt) : null}
            />
            <Field label="Completed" value={b.completedAt ? formatDate(b.completedAt) : null} />
          </dl>
          {b.customerNotes && (
            <div className="mt-4">
              <dt className="text-xs font-medium text-slate-500 uppercase">Customer notes</dt>
              <dd className="mt-0.5 text-sm text-slate-900">{b.customerNotes}</dd>
            </div>
          )}
        </CardBody>
      </Card>

      {b.cancelledAt && (
        <Card>
          <CardHeader>
            <CardTitle>Cancellation</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Cancelled at" value={formatDate(b.cancelledAt)} />
              <Field label="Cancelled by user" value={b.cancelledByUserId} />
              <Field label="Reason" value={b.cancellationReason} />
            </dl>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assignment offers</CardTitle>
        </CardHeader>
        <CardBody>
          {b.offers.length === 0 ? (
            <p className="text-sm text-slate-500">No offers were made.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Wave</Th>
                  <Th>Status</Th>
                  <Th>Distance</Th>
                  <Th>Offered</Th>
                  <Th>Responded</Th>
                </Tr>
              </Thead>
              <Tbody>
                {b.offers.map((o) => (
                  <Tr key={o.id}>
                    <Td>{o.wave}</Td>
                    <Td>{titleCase(o.status)}</Td>
                    <Td>{o.distanceKm ? `${o.distanceKm} km` : '—'}</Td>
                    <Td>{formatDate(o.offeredAt)}</Td>
                    <Td>{o.respondedAt ? formatDate(o.respondedAt) : '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {b.releases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provider releases</CardTitle>
          </CardHeader>
          <CardBody>
            <Table>
              <Thead>
                <Tr>
                  <Th>Reason</Th>
                  <Th>Released</Th>
                </Tr>
              </Thead>
              <Tbody>
                {b.releases.map((r, idx) => (
                  <Tr key={`${r.providerProfileId}-${idx.toString()}`}>
                    <Td>{r.reason ?? '—'}</Td>
                    <Td>{formatDate(r.releasedAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
