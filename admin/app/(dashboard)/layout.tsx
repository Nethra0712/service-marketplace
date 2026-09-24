'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

/**
 * Gate is client-side and UX-only — see `lib/auth-context.tsx`. Every page
 * under this layout still gets its own 401s from the API if the session
 * turns out not to be valid; this just avoids flashing protected content
 * before that round trip completes.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'unauthenticated') router.replace('/login');
  }, [state.status, router]);

  if (state.status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
