'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const router = useRouter();
  const { state, logout } = useAuth();
  const admin = state.status === 'authenticated' ? state.admin : undefined;

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
      {admin && (
        <>
          <span className="text-sm text-slate-600">
            {admin.fullName} <span className="text-slate-400">· {admin.email}</span>
          </span>
          <Button variant="secondary" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </>
      )}
    </header>
  );
}
