'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { pageFadeRise, staggerContainer, staggerItem } from '@/lib/motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercent } from '@/lib/format';

interface DecisionListItem {
  id: string;
  title: string;
  type: 'BUDGET_SHIFT' | 'ANOMALY_ALERT';
  status: string;
  expectedImpact: string;
  confidence: number;
  createdAt: string;
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

const STATUS_OPTIONS = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'LIVE', 'COMPLETED', 'REJECTED', 'ROLLED_BACK'];
const TYPE_OPTIONS = ['ALL', 'BUDGET_SHIFT', 'ANOMALY_ALERT'];

export function DecisionsView() {
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');

  const query = useQuery({
    queryKey: ['decisions', 'list', status, type],
    queryFn: () => {
      const params = new URLSearchParams({ sort: 'priority' });
      if (status !== 'ALL') params.set('status', status);
      if (type !== 'ALL') params.set('type', type);
      return apiFetch<DecisionListItem[]>(`/decisions?${params.toString()}`);
    },
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Decisions</h1>
        <p className="mt-1 text-sm text-text-dim">Every recommendation the engine has made, filterable by status and type.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-[40px] rounded-btn border border-card-border bg-card px-3 text-sm text-text"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="min-h-[40px] rounded-btn border border-card-border bg-card px-3 text-sm text-text"
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'ALL' ? 'All types' : t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {!query.data && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {query.data && query.data.length === 0 && (
        <Card>
          <p className="py-6 text-center text-sm text-text-dim">No decisions match these filters.</p>
        </Card>
      )}

      {query.data && query.data.length > 0 && (
        <motion.ul initial="hidden" animate="visible" variants={staggerContainer} className="space-y-2">
          {query.data.map((d) => (
            <motion.li key={d.id} variants={staggerItem}>
              <Link href={`/decisions/${d.id}`}>
                <Card className="transition-colors hover:bg-bg-elev">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{d.title}</p>
                      <p className="mt-1 text-xs text-text-dim">
                        {d.type.replace('_', ' ')} · {d.approvalProgress.done}/{d.approvalProgress.total} approvals ·
                        confidence {formatPercent(d.confidence)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-sm text-text-dim">{formatCurrency(Number(d.expectedImpact))}</span>
                      <Badge tone={STATUS_TONE[d.status] ?? 'neutral'}>{d.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  );
}
