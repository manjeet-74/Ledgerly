'use client';

import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ApprovalRow {
  id: string;
  step: 'MARKETING' | 'FINANCE' | 'EXECUTIVE';
  order: number;
  result: 'PENDING' | 'GRANTED' | 'REJECTED';
  actorName: string | null;
  actorRole: string | null;
  comment: string | null;
  decidedAt: string | null;
}

const STEP_LABEL: Record<ApprovalRow['step'], string> = {
  MARKETING: 'Marketing',
  FINANCE: 'Finance',
  EXECUTIVE: 'Executive',
};

export function ApprovalStepper({ approvals }: { approvals: ApprovalRow[] }) {
  const sorted = [...approvals].sort((a, b) => a.order - b.order);

  return (
    <ol className="flex items-start gap-2">
      {sorted.map((a, i) => (
        <li key={a.id} className="flex flex-1 items-center gap-2">
          <div className="flex flex-col items-center gap-2 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2',
                a.result === 'GRANTED' && 'border-ok bg-ok/15 text-ok',
                a.result === 'REJECTED' && 'border-bad bg-bad/15 text-bad',
                a.result === 'PENDING' && 'border-card-border bg-card text-text-dim',
              )}
            >
              {a.result === 'GRANTED' && <Check size={18} />}
              {a.result === 'REJECTED' && <X size={18} />}
              {a.result === 'PENDING' && <Clock size={16} />}
            </motion.div>
            <div>
              <p className="text-xs font-medium text-text">{STEP_LABEL[a.step]}</p>
              {a.actorName && <p className="text-[11px] text-text-dim">{a.actorName}</p>}
            </div>
          </div>
          {i < sorted.length - 1 && (
            <div className={cn('mt-[-20px] h-0.5 flex-1', a.result === 'GRANTED' ? 'bg-ok' : 'bg-card-border')} />
          )}
        </li>
      ))}
    </ol>
  );
}
