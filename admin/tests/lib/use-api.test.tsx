import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApi } from '@/lib/use-api';

describe('useApi', () => {
  it('starts in loading state and transitions to success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useApi(fetcher));

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(result.current).toMatchObject({ status: 'success', data: { value: 42 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('transitions to error state when the fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current).toMatchObject({ status: 'error', error: new Error('network down') });
  });

  it('re-runs the fetcher when reload is called', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() => useApi(fetcher));

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores a stale response if the fetcher changes before it resolves', async () => {
    let resolveFirst!: (value: { source: string }) => void;
    const firstFetcher = vi.fn(
      () =>
        new Promise<{ source: string }>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const secondFetcher = vi.fn().mockResolvedValue({ source: 'second' });

    const { result, rerender } = renderHook(({ fetcher }) => useApi(fetcher), {
      initialProps: { fetcher: firstFetcher },
    });

    rerender({ fetcher: secondFetcher });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(result.current).toMatchObject({ status: 'success', data: { source: 'second' } });

    // The first, now-superseded fetch resolving afterwards must not clobber
    // the second one's result.
    act(() => {
      resolveFirst({ source: 'first' });
    });
    expect(result.current).toMatchObject({ status: 'success', data: { source: 'second' } });
  });
});
