'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api-client';

export interface AdminIdentity {
  id: string;
  email: string;
  fullName: string;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; admin: AdminIdentity }
  | { status: 'unauthenticated' };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * The admin app's own notion of "am I signed in" — purely for UI/UX
 * (showing the right screen, redirecting to /login). It is never what
 * actually gates a protected action: every API call is independently
 * authorized by the backend regardless of what this says, so a bug here can
 * make the UI wrong but can never grant access to anything.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const { admin } = await api.get<{ admin: AdminIdentity }>('/api/admin/auth/me');
      setState({ status: 'authenticated', admin });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: 'unauthenticated' });
      } else {
        // A network/server error is not the same as "not signed in" — but
        // there is nothing else useful to show, so treat it the same way
        // rather than getting stuck on a spinner forever.
        setState({ status: 'unauthenticated' });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { admin } = await api.post<{ admin: AdminIdentity }>('/api/admin/auth/login', {
      email,
      password,
    });
    setState({ status: 'authenticated', admin });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/admin/auth/logout');
    } finally {
      setState({ status: 'unauthenticated' });
    }
  }, []);

  return <AuthContext.Provider value={{ state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
