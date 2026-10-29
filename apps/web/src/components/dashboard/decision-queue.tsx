'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { formatCurrency } from '@/lib/format';

export interface QueueDecision {
  id: string;
  title: string;
  type: string;
  status: string;
  expectedImpact: string;
  confidence: number;
  approvalProgress: { done: number; total: number };
}

const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand'> = {
  PENDING_REVIEW: 'warn',
  APPROVED: 'info',
  LIVE: 'ok',
  COMPLETED: 'brand',
  REJECTED: 'bad',
  ROLLED_BACK: 'bad',
};

export function DecisionQueue({ decisions }: { decisions?: QueueDecision[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision queue</CardTitle>
        <Link href="/decisions" className="text-xs font-medium text-brand-2 hover:underline">
          View all
        </Link>
      </CardHeader>

      {!decisions && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {decisions && decisions.length === 0 && (
        <p className="py-6 text-center text-sm text-text-dim">No open decisions right now. Run the engine from the Data page.</p>
      )}

      {decisions && decisions.length > 0 && (
        <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="space-y-2">
          {decisions.map((d) => (
            <motion.li key={d.id} variants={staggerItem}>
              <Link
                href={`/decisions/${d.id}`}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-btn border border-card-border bg-bg-elev px-4 py-3 transition-colors hover:bg-card"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{d.title}</p>
                  <p className="mt-1 text-xs text-text-dim">
                    {d.approvalProgress.done}/{d.approvalProgress.total} approvals · confidence {Math.round(d.confidence * 100)}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm text-text-dim">{formatCurrency(Number(d.expectedImpact))}</span>
                  <Badge tone={STATUS_TONE[d.status] ?? 'neutral'}>{d.status.replace('_', ' ')}</Badge>
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Card>
  );
}
