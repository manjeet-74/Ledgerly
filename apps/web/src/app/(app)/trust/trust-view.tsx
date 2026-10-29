'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { pageFadeRise, staggerContainer, staggerItem } from '@/lib/motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';

interface TrustControl {
  id: string;
  title: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  checkedAt: string;
}

export function TrustView() {
  const query = useQuery({
    queryKey: ['trust', 'controls'],
    queryFn: () => apiFetch<TrustControl[]>('/trust/controls'),
    refetchOnWindowFocus: true,
  });

  const passCount = query.data?.filter((c) => c.status === 'PASS').length ?? 0;
  const total = query.data?.length ?? 0;

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Trust Center</h1>
        <p className="mt-1 text-sm text-text-dim">
          Live controls, measured against the system actually running right now — not a slide deck.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-btn border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <strong>Illustrative.</strong> Ledgerly is an independent concept project, not a production
          compliance product. These controls demonstrate the pattern of continuous, verifiable trust
          controls; they are not a certification or audit opinion.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text">
              {query.data ? `${passCount} / ${total} controls passing` : 'Checking controls…'}
            </p>
            <p className="text-xs text-text-dim">Re-run after a tamper or repair on the Audit page to see this update.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={14} className={cn(query.isFetching && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
        </div>
      </Card>

      {!query.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {query.data && (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {query.data.map((c) => (
            <motion.div key={c.id} variants={staggerItem}>
              <Card
                className={cn('h-full border-l-4', c.status === 'PASS' ? 'border-l-ok' : 'border-l-bad')}
              >
                <div className="flex items-start gap-2">
                  {c.status === 'PASS' ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" />
                  ) : (
                    <XCircle size={18} className="mt-0.5 shrink-0 text-bad" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-text">{c.title}</p>
                    <p className="mt-1 text-sm text-text-dim">{c.detail}</p>
                    <p className="mt-2 text-xs text-text-dim">Checked {formatDateTime(c.checkedAt)}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Card>
        <h2 className="font-display text-base font-semibold text-text">How these controls work</h2>
        <p className="mt-2 text-sm text-text-dim">
          Each control queries the live database or introspects the running API — it does not read a
          static configuration file. <code className="font-mono text-xs">RBAC_ENFORCED</code>, for
          example, counts the endpoints actually decorated with role restrictions in the code that is
          currently deployed, using Nest&apos;s own metadata reflection. Tampering with the audit chain
          on the Audit page and returning here will flip{' '}
          <code className="font-mono text-xs">AUDIT_CHAIN_INTACT</code> to FAIL until it is repaired.
        </p>
      </Card>
    </motion.div>
  );
}
