'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChainVerifyReport {
  ok: boolean;
  total: number;
  brokenAtSeq?: number;
  reason?: string;
  verifiedAt: string;
}

export function VerifyBanner({ report }: { report?: ChainVerifyReport }) {
  if (!report) return null;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 rounded-btn border p-3 text-sm',
        report.ok ? 'border-ok/30 bg-ok/10 text-ok' : 'border-bad/30 bg-bad/10 text-bad',
      )}
    >
      {report.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span>
        {report.ok
          ? `Chain verified OK — ${report.total} events, no tampering detected.`
          : `Chain verification FAILED at seq ${report.brokenAtSeq} (${report.reason}).`}
      </span>
    </motion.div>
  );
}
