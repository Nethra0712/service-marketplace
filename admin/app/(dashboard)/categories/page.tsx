'use client';

import { useCallback, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { formatMoney, titleCase } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';

type PricingModel = 'fixed' | 'hourly' | 'quote';

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricingModel: PricingModel;
  baseRate: string | null;
  isActive: boolean;
  createdAt: string;
}

function CreateCategoryForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed');
  const [baseRate, setBaseRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/admin/categories', {
        slug,
        name,
        description: description || undefined,
        pricingModel,
        baseRate: pricingModel === 'quote' ? undefined : Number(baseRate),
      });
      setSlug('');
      setName('');
      setDescription('');
      setBaseRate('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create category.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New category</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="deep-cleaning"
            />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deep Cleaning"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pricingModel">Pricing model</Label>
            <Select
              id="pricingModel"
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as PricingModel)}
            >
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
              <option value="quote">Quote</option>
            </Select>
          </div>
          {pricingModel !== 'quote' && (
            <div>
              <Label htmlFor="baseRate">Base rate (LKR)</Label>
              <Input
                id="baseRate"
                type="number"
                min="0"
                step="0.01"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
              />
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button
          disabled={submitting || !slug || !name || (pricingModel !== 'quote' && !baseRate)}
          onClick={() => void submit()}
        >
          {submitting ? 'Creating…' : 'Create category'}
        </Button>
      </CardBody>
    </Card>
  );
}

function CategoryEditRow({ category, onSaved }: { category: Category; onSaved: () => void }) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const [pricingModel, setPricingModel] = useState<PricingModel>(category.pricingModel);
  const [baseRate, setBaseRate] = useState(category.baseRate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/admin/categories/${category.id}`, {
        name,
        description: description || null,
        pricingModel,
        baseRate: pricingModel === 'quote' ? null : Number(baseRate),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Tr>
      <Td colSpan={6}>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value as PricingModel)}
            >
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
              <option value="quote">Quote</option>
            </Select>
            {pricingModel !== 'quote' && (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                placeholder="Base rate"
              />
            )}
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button disabled={submitting} onClick={() => void save()}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Td>
    </Tr>
  );
}

export default function CategoriesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fetcher = useCallback(() => api.get<{ items: Category[] }>('/api/admin/categories'), []);
  const result = useApi(fetcher);

  async function toggleActive(category: Category) {
    await api.patch(`/api/admin/categories/${category.id}`, { isActive: !category.isActive });
    result.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Service categories</h1>
        <Button variant="secondary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New category'}
        </Button>
      </div>

      {showCreate && (
        <CreateCategoryForm
          onCreated={() => {
            setShowCreate(false);
            result.reload();
          }}
        />
      )}

      <Card>
        {result.status === 'loading' && <LoadingState />}
        {result.status === 'error' && <ErrorState error={result.error} onRetry={result.reload} />}
        {result.status === 'success' &&
          (result.data.items.length === 0 ? (
            <EmptyState message="No service categories yet." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Pricing</Th>
                  <Th>Base rate</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {result.data.items.map((c) =>
                  editingId === c.id ? (
                    <CategoryEditRow
                      key={c.id}
                      category={c}
                      onSaved={() => {
                        setEditingId(null);
                        result.reload();
                      }}
                    />
                  ) : (
                    <Tr key={c.id}>
                      <Td className="font-medium text-slate-900">{c.name}</Td>
                      <Td>{c.slug}</Td>
                      <Td>{titleCase(c.pricingModel)}</Td>
                      <Td>{c.baseRate ? formatMoney(c.baseRate) : '—'}</Td>
                      <Td>
                        <Badge tone={c.isActive ? 'good' : 'neutral'}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Button variant="secondary" onClick={() => setEditingId(c.id)}>
                            Edit
                          </Button>
                          <Button variant="secondary" onClick={() => void toggleActive(c)}>
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ),
                )}
              </Tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
