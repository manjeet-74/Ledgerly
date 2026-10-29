'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle size={40} className="text-bad" aria-hidden />
      <h1 className="font-display text-2xl font-semibold text-text">Something went wrong</h1>
      <p className="max-w-sm text-sm text-text-dim">
        An unexpected error occurred while rendering this page. You can try again, or head back to the
        dashboard.
      </p>
      <div className="mt-2 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
          Dashboard
        </Button>
      </div>
    </main>
  );
}
