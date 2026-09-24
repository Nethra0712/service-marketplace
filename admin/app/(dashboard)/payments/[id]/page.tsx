'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatDate, formatMoney, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { ErrorState, LoadingState } from '@/components/ui/states';

interface PaymentDetail {
  payment: {
    id: string;
    bookingId: string;
    status: string;
    serviceAmount: string;
    commissionAmount: string;
    providerEarningAmount: string;
    currency: string;
    customerName: string | null;
    providerName: string | null;
    createdAt: string;
    succeededAt: string | null;
    externalReference: string;
    providerPaymentId: string | null;
  };
  ledger: {
    id: string;
    kind: string;
    status: string;
    providerPaymentId: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => api.get<PaymentDetail>(`/api/admin/payments/${id}`), [id]);
  const result = useApi(fetcher);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/admin/payments/${id}/refund`, { reason });
      setReason('');
      result.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Refund failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result.status === 'loading') return <LoadingState />;
  if (result.status === 'error') return <ErrorState error={result.error} onRetry={result.reload} />;

  const { payment, ledger } = result.data;
  const canRefund = payment.status === 'succeeded';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          {payment.customerName ?? '(unknown customer)'}
        </h1>
        <Badge
          tone={
            payment.status === 'refunded'
              ? 'bad'
              : payment.status === 'succeeded'
                ? 'good'
                : 'neutral'
          }
        >
          {titleCase(payment.status)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Provider" value={payment.providerName} />
            <Field label="Service amount" value={formatMoney(payment.serviceAmount)} />
            <Field label="Commission" value={formatMoney(payment.commissionAmount)} />
            <Field label="Provider earning" value={formatMoney(payment.providerEarningAmount)} />
            <Field label="Currency" value={payment.currency} />
            <Field label="External reference" value={payment.externalReference} />
            <Field label="Provider payment id" value={payment.providerPaymentId} />
            <Field label="Created" value={formatDate(payment.createdAt)} />
            <Field
              label="Succeeded"
              value={payment.succeededAt ? formatDate(payment.succeededAt) : null}
            />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
        </CardHeader>
        <CardBody>
          {ledger.length === 0 ? (
            <p className="text-sm text-slate-500">No ledger entries.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Kind</Th>
                  <Th>Status</Th>
                  <Th>Note</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {ledger.map((entry) => (
                  <Tr key={entry.id}>
                    <Td>{titleCase(entry.kind)}</Td>
                    <Td>{titleCase(entry.status)}</Td>
                    <Td>{entry.note ?? '—'}</Td>
                    <Td>{formatDate(entry.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {canRefund && (
        <Card>
          <CardHeader>
            <CardTitle>Refund</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button
              variant="danger"
              disabled={submitting || !reason.trim()}
              onClick={() => void refund()}
            >
              {submitting ? 'Refunding…' : 'Refund payment'}
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
