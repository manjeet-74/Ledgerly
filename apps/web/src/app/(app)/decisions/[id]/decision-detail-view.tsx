'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { pageFadeRise } from '@/lib/motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ConfidenceRing } from '@/components/decisions/confidence-ring';
import { EvidenceTimeline, type EvidenceStep } from '@/components/decisions/evidence-timeline';
import { ApprovalStepper, type ApprovalRow } from '@/components/decisions/approval-stepper';
import { ActionPanel } from '@/components/decisions/action-panel';
import { OutcomePanel, type Outcome } from '@/components/decisions/outcome-panel';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface AuditRow {
  id: string;
  seq: number;
  type: string;
  actorName: string;
  message: string;
  createdAt: string;
}

interface DecisionDetail {
  id: string;
  type: 'BUDGET_SHIFT' | 'ANOMALY_ALERT';
  title: string;
  summary: string;
  status: string;
  expectedImpact: string;
  confidence: number;
  params: Record<string, unknown>;
  spendCap: string | null;
  owner: string;
  deadline: string;
  createdAt: string;
  executedAt: string | null;
  evidence: EvidenceStep[];
  approvals: ApprovalRow[];
  outcome: Outcome | null;
  audit: AuditRow[];
}

const STATUS_TONE: Record<string, 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand'> = {
  PENDING_REVIEW: 'warn',
  APPROVED: 'info',
  LIVE: 'ok',
  COMPLETED: 'brand',
  REJECTED: 'bad',
  ROLLED_BACK: 'bad',
};

export function DecisionDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const query = useQuery({
    queryKey: ['decision', id],
    queryFn: () => apiFetch<DecisionDetail>(`/decisions/${id}`),
  });

  if (!query.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const decision = query.data;

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[decision.status] ?? 'neutral'}>{decision.status.replace('_', ' ')}</Badge>
              <span className="text-xs text-text-dim">{decision.type.replace('_', ' ')}</span>
            </div>
            <h1 className="mt-2 font-display text-xl font-semibold text-text">{decision.title}</h1>
            <p className="mt-2 max-w-xl text-sm text-text-dim">{decision.summary}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-dim">
              <span>Owner: {decision.owner.replace('_', ' ')}</span>
              <span>Deadline: {formatDateTime(decision.deadline)}</span>
              {decision.spendCap && <span>Spend cap: {formatCurrency(Number(decision.spendCap))}</span>}
              {decision.executedAt && <span>Executed: {formatDateTime(decision.executedAt)}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <ConfidenceRing confidence={decision.confidence} />
            <span className="font-mono text-sm text-text">{formatCurrency(Number(decision.expectedImpact))}/wk</span>
          </div>
        </div>
      </Card>

      <Card>
        <Tabs
          defaultTab="evidence"
          tabs={[
            {
              key: 'evidence',
              label: `Evidence (${decision.evidence.length})`,
              content: <EvidenceTimeline steps={decision.evidence} />,
            },
            {
              key: 'approval',
              label: 'Approval',
              content: (
                <div className="space-y-6">
                  <ApprovalStepper approvals={decision.approvals} />
                  <ActionPanel
                    decision={{
                      id: decision.id,
                      status: decision.status,
                      type: decision.type,
                      spendCap: decision.spendCap,
                      params: decision.params,
                      approvals: decision.approvals,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'audit',
              label: `Audit (${decision.audit.length})`,
              content:
                decision.audit.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-dim">No audit events for this decision yet.</p>
                ) : (
                  <ul className="divide-y divide-card-border">
                    {decision.audit.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="font-mono text-xs text-text-dim">#{e.seq}</span>
                        <span className="min-w-0 flex-1 text-text">{e.message}</span>
                        <span className="shrink-0 text-xs text-text-dim">{formatDateTime(e.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'outcome',
              label: 'Outcome',
              content: <OutcomePanel outcome={decision.outcome} />,
            },
          ]}
        />
      </Card>
    </motion.div>
  );
}
