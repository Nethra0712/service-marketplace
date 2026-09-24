import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiFetch } from '@/lib/api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    document.cookie = 'admin_csrf=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends credentials and no CSRF header on a GET request', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await apiFetch('/api/admin/auth/me');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('attaches the CSRF cookie as a header on a mutating request', async () => {
    document.cookie = 'admin_csrf=test-csrf-token';
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));

    await apiFetch('/api/admin/reviews/some-id/hide', { method: 'POST', body: {} });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('test-csrf-token');
  });

  it('omits the CSRF header on a mutating request when no cookie is set', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));

    await apiFetch('/api/admin/reviews/some-id/hide', { method: 'POST', body: {} });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('returns undefined for a 204 response without parsing a body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiFetch('/api/admin/users/some-id/reactivate', {
      method: 'POST',
      body: {},
    });

    expect(result).toBeUndefined();
  });

  it('resolves with the parsed JSON body on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [1, 2, 3] }));

    const result = await api.get<{ items: number[] }>('/api/admin/users');

    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('throws an ApiError built from the standard error envelope', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'CSRF_TOKEN_INVALID', message: 'CSRF token is missing or invalid.' },
      }),
    );

    await expect(
      apiFetch('/api/admin/users/some-id/suspend', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_INVALID',
      message: 'CSRF token is missing or invalid.',
    });
  });

  it('falls back to a generic ApiError when the error body has no content-type', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const error = await apiFetch('/api/admin/dashboard').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe('UNKNOWN_ERROR');
  });

  it('propagates validation details from the error envelope', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input.',
          details: [{ path: 'baseRate', message: 'Does not match pricingModel.' }],
        },
      }),
    );

    const error = await api.post('/api/admin/categories', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual([
      { path: 'baseRate', message: 'Does not match pricingModel.' },
    ]);
  });
});
