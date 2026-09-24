import { ApiError } from '@/lib/api-client';
import { Button } from './button';

export function LoadingState() {
  return <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>;
}

/** Admin-facing, so the raw backend message is shown directly (never a customer-facing screen — see `error-message.dart` on the mobile side for the localized equivalent). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-500">{message}</p>;
}
