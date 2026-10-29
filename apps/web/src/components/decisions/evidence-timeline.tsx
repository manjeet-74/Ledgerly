'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Cpu, ListChecks, Calculator, ChevronDown, CheckCircle2, XCircle, Info } from 'lucide-react';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface EvidenceStep {
  id: string;
  order: number;
  kind: 'DATA' | 'MODEL' | 'RULE' | 'CALC';
  title: string;
  detail: string;
  status: 'PASS' | 'FAIL' | 'INFO';
  payload: Record<string, unknown>;
}

const KIND_ICON: Record<EvidenceStep['kind'], typeof Database> = {
  DATA: Database,
  MODEL: Cpu,
  RULE: ListChecks,
  CALC: Calculator,
};

const STATUS_ICON: Record<EvidenceStep['status'], typeof CheckCircle2> = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  INFO: Info,
};

const STATUS_COLOR: Record<EvidenceStep['status'], string> = {
  PASS: 'text-ok',
  FAIL: 'text-bad',
  INFO: 'text-info',
};

function EvidenceRow({ step }: { step: EvidenceStep }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[step.kind];
  const StatusIcon = STATUS_ICON[step.status];

  return (
    <motion.li variants={staggerItem} className="relative pb-6 pl-10 last:pb-0">
      <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-card-border bg-bg-elev">
        <Icon size={14} className="text-brand-2" aria-hidden />
      </span>
      <span className="absolute left-[13px] top-7 h-[calc(100%-28px)] w-px bg-card-border last:hidden" aria-hidden />

      <div className="rounded-btn border border-card-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <StatusIcon size={14} className={STATUS_COLOR[step.status]} aria-hidden />
              {step.title}
            </p>
            <p className="mt-1 text-sm text-text-dim">{step.detail}</p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-btn px-2 py-1 text-xs font-medium text-text-dim hover:bg-bg-elev hover:text-text"
            aria-expanded={open}
          >
            Show the math
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
        {open && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-bg-elev p-3 font-mono text-xs text-text-dim">
            {JSON.stringify(step.payload, null, 2)}
          </pre>
        )}
      </div>
    </motion.li>
  );
}

export function EvidenceTimeline({ steps }: { steps: EvidenceStep[] }) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return (
    <motion.ol initial="hidden" animate="visible" variants={staggerContainer}>
      {sorted.map((step) => (
        <EvidenceRow key={step.id} step={step} />
      ))}
    </motion.ol>
  );
}
