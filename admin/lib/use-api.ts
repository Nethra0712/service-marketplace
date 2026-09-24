'use client';

import { useEffect, useState } from 'react';

export type ApiState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

/**
 * Runs `fetcher` on mount and whenever it changes (memoize it with
 * `useCallback` at the call site — this hook does not accept a separate
 * `deps` array, so there is nothing here for `react-hooks/exhaustive-deps`
 * to get wrong). `reload()` re-runs it, e.g. after a mutation.
 */
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> & { reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, reloadKey]);

  return { ...state, reload: () => setReloadKey((k) => k + 1) };
}
