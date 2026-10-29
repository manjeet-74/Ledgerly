'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import { downloadFromApi } from '@/lib/download';
import { useMode } from '@/lib/mode';
import { pageFadeRise } from '@/lib/motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChainStrip } from '@/components/audit/chain-strip';
import { VerifyBanner, type ChainVerifyReport } from '@/components/audit/verify-banner';
import { formatDateTime } from '@/lib/format';

interface AuditRow {
  id: string;
  seq: number;
  type: string;
  actorName: string;
  actorRole: string;
  decisionId: string | null;
  message: string;
  createdAt: string;
}

const AUDITOR_ROLES = ['AUDITOR', 'ADMIN'];

export function AuditView() {
  const { workspace, demoRole } = useMode();
  const qc = useQueryClient();
  const [shakeKey, setShakeKey] = useState(0);
  const [verifyReport, setVerifyReport] = useState<ChainVerifyReport | undefined>();

  const canAudit = workspace === 'LIVE' || AUDITOR_ROLES.includes(demoRole);

  const listQuery = useQuery({
    queryKey: ['audit', 'full'],
    queryFn: () => apiFetch<AuditRow[]>('/audit?limit=100'),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiFetch<ChainVerifyReport>('/audit/verify'),
    onSuccess: (report) => {
      setVerifyReport(report);
      toast[report.ok ? 'success' : 'error'](report.ok ? 'Chain verified OK.' : `Chain broken at seq ${report.brokenAtSeq}.`);
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed.'),
  });

  const tamperMutation = useMutation({
    mutationFn: () => apiFetch<{ tamperedSeq: number } | null>('/audit/demo/tamper', { method: 'POST' }),
    onSuccess: (res) => {
      if (res) {
        toast.warning(`Tampered event #${res.tamperedSeq}. Run Verify to see it fail.`);
        setShakeKey((k) => k + 1);
      }
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Tamper failed.'),
  });

  const repairMutation = useMutation({
    mutationFn: () => apiFetch<ChainVerifyReport>('/audit/demo/repair', { method: 'POST' }),
    onSuccess: (report) => {
      setVerifyReport(report);
      toast.success('Chain repaired — recomputed forward from seq 1.');
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Repair failed.'),
  });

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await downloadFromApi(`/audit/export?format=${format}`, `audit-export.${format}`);
      toast.success(`Exported audit chain as ${format.toUpperCase()}.`);
    } catch {
      toast.error('Export failed — requires Auditor or Admin role.');
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Audit Trail</h1>
        <p className="mt-1 text-sm text-text-dim">
          A tamper-evident, hash-chained record of every decision, approval, and execution.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chain</CardTitle>
        </CardHeader>

        {!listQuery.data && <Skeleton className="h-10 w-full" />}
        {listQuery.data && (
          <ChainStrip
            blocks={[...listQuery.data].reverse().map((e) => ({ seq: e.seq, type: e.type }))}
            brokenAtSeq={verifyReport?.ok === false ? verifyReport.brokenAtSeq : undefined}
            shakeKey={shakeKey}
          />
        )}

        <VerifyBanner report={verifyReport} />

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!canAudit || verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
            Verify chain
          </Button>
          <Button variant="secondary" disabled={!canAudit} onClick={() => handleExport('json')}>
            Export JSON
          </Button>
          <Button variant="secondary" disabled={!canAudit} onClick={() => handleExport('csv')}>
            Export CSV
          </Button>
          {workspace === 'DEMO' && (
            <>
              <Button variant="destructive" disabled={tamperMutation.isPending} onClick={() => tamperMutation.mutate()}>
                Tamper demo
              </Button>
              <Button variant="secondary" disabled={repairMutation.isPending} onClick={() => repairMutation.mutate()}>
                Repair chain
              </Button>
            </>
          )}
        </div>
        {!canAudit && (
          <p className="mt-2 text-xs text-text-dim">Switch demo role to Auditor or Admin to verify/export.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events ({listQuery.data?.length ?? 0})</CardTitle>
        </CardHeader>

        {!listQuery.data && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {listQuery.data && (
          <ul className="divide-y divide-card-border">
            {listQuery.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-mono text-xs text-text-dim">#{e.seq}</span>
                <span className="hidden shrink-0 text-xs font-medium text-text-dim sm:inline-block sm:w-40">{e.type}</span>
                <span className="min-w-0 flex-1 basis-full truncate text-text sm:basis-0">{e.message}</span>
                <span className="max-w-[6rem] shrink-0 truncate text-xs text-text-dim">{e.actorName}</span>
                <span className="shrink-0 text-xs text-text-dim">{formatDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
