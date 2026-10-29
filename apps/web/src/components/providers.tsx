'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ModeProvider } from '@/lib/mode';
import { CommandPalette } from '@/components/command-palette';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ModeProvider>
        {children}
        <CommandPalette />
        <Toaster theme="dark" richColors position="bottom-right" />
      </ModeProvider>
    </QueryClientProvider>
  );
}
