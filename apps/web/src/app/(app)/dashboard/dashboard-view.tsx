'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { pageFadeRise } from '@/lib/motion';
import { StatCards, type DecisionStats } from '@/components/dashboard/stat-cards';
import { DecisionQueue, type QueueDecision } from '@/components/dashboard/decision-queue';
import { ImpactChart, type DailyPoint } from '@/components/dashboard/impact-chart';
import { RecentAudit, type AuditRow } from '@/components/dashboard/recent-audit';

interface DataSummary {
  daily: DailyPoint[];
}

export function DashboardView() {
  const statsQuery = useQuery({
    queryKey: ['decisions', 'stats'],
    queryFn: () => apiFetch<DecisionStats>('/decisions/stats'),
  });

  const queueQuery = useQuery({
    queryKey: ['decisions', 'queue'],
    queryFn: () => apiFetch<QueueDecision[]>('/decisions?sort=priority'),
    select: (decisions) => decisions.filter((d) => d.status === 'PENDING_REVIEW' || d.status === 'APPROVED').slice(0, 6),
  });

  const summaryQuery = useQuery({
    queryKey: ['data', 'summary'],
    queryFn: () => apiFetch<DataSummary>('/data/summary'),
  });

  const auditQuery = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => apiFetch<AuditRow[]>('/audit?limit=6'),
  });

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-dim">Live state of the decision engine and its audit trail.</p>
      </div>

      <StatCards stats={statsQuery.data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DecisionQueue decisions={queueQuery.data} />
        <ImpactChart daily={summaryQuery.data?.daily} />
      </div>

      <RecentAudit events={auditQuery.data} />
    </motion.div>
  );
}
