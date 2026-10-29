'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import { useMode } from '@/lib/mode';
import { Button } from '@/components/ui/button';
import type { ApprovalRow } from './approval-stepper';

interface Decision {
  id: string;
  status: string;
  type: string;
  spendCap: string | null;
  params: { shiftAmount?: number; to?: string; channel?: string };
  approvals: ApprovalRow[];
}

const STEP_ROLES: Record<string, string[]> = {
  MARKETING: ['MARKETING_DIRECTOR', 'ADMIN'],
  FINANCE: ['FINANCE', 'ADMIN'],
  EXECUTIVE: ['ADMIN'],
};
const EXECUTOR_ROLES = ['EXECUTOR', 'ADMIN'];

function useInvalidateDecision(decisionId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['decision', decisionId] });
    qc.invalidateQueries({ queryKey: ['decisions'] });
    qc.invalidateQueries({ queryKey: ['audit'] });
  };
}

export function ActionPanel({ decision }: { decision: Decision }) {
  const { demoRole, workspace } = useMode();
  const invalidate = useInvalidateDecision(decision.id);

  const nextApproval = decision.approvals
    .slice()
    .sort((a, b) => a.order - b.order)
    .find((a) => a.result === 'PENDING');

  const approveMutation = useMutation({
    mutationFn: (body: { comment?: string; spendCap?: number }) =>
      apiFetch(`/decisions/${decision.id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Approval recorded.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Approve failed.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (comment: string) =>
      apiFetch(`/decisions/${decision.id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }),
    onSuccess: () => {
      toast.success('Decision rejected.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Reject failed.'),
  });

  const executeMutation = useMutation({
    mutationFn: (rollback: { metric: 'ROAS'; channel: string; below: number; afterDays: number }) =>
      apiFetch(`/decisions/${decision.id}/execute`, { method: 'POST', body: JSON.stringify({ rollback }) }),
    onSuccess: () => {
      toast.success('Decision executed and is now LIVE.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Execute failed.'),
  });

  const rollbackMutation = useMutation({
    mutationFn: () => apiFetch(`/decisions/${decision.id}/rollback`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Rollback triggered.');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Rollback failed.'),
  });

  const simulateMutation = useMutation({
    mutationFn: () => apiFetch(`/decisions/${decision.id}/outcome/simulate`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Outcome simulated (fast-forwarded 7 days).');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Simulate failed.'),
  });

  const [comment, setComment] = useState('');
  const [spendCap, setSpendCap] = useState('');
  const [rollbackBelow, setRollbackBelow] = useState('1');
  const [rollbackDays, setRollbackDays] = useState('7');

  if (decision.status === 'PENDING_REVIEW' && nextApproval) {
    const canAct = (STEP_ROLES[nextApproval.step] ?? []).includes(demoRole);
    const isFinance = nextApproval.step === 'FINANCE';

    return (
      <div className="rounded-btn border border-card-border bg-card p-4">
        <p className="text-sm font-medium text-text">
          Awaiting {nextApproval.step.toLowerCase()} approval
          {!canAct && <span className="ml-2 text-xs text-text-dim">(switch demo role to act)</span>}
        </p>

        {isFinance && (
          <div className="mt-3">
            <label className="text-xs font-medium text-text-dim" htmlFor="spendCap">
              Spend cap ($)
            </label>
            <input
              id="spendCap"
              type="number"
              value={spendCap}
              onChange={(e) => setSpendCap(e.target.value)}
              placeholder={decision.params.shiftAmount ? String(decision.params.shiftAmount) : '0'}
              className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
            />
          </div>
        )}

        <div className="mt-3">
          <label className="text-xs font-medium text-text-dim" htmlFor="comment">
            Comment (required to reject)
          </label>
          <input
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            disabled={!canAct || approveMutation.isPending || (isFinance && !spendCap)}
            onClick={() =>
              approveMutation.mutate({
                comment: comment || undefined,
                spendCap: isFinance ? Number(spendCap) : undefined,
              })
            }
          >
            Approve
          </Button>
          <Button
            variant="destructive"
            disabled={!canAct || rejectMutation.isPending || comment.trim().length < 5}
            onClick={() => rejectMutation.mutate(comment)}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (decision.status === 'APPROVED') {
    const canExecute = EXECUTOR_ROLES.includes(demoRole);
    return (
      <div className="rounded-btn border border-card-border bg-card p-4">
        <p className="text-sm font-medium text-text">
          Approved — ready to execute{' '}
          {!canExecute && <span className="text-xs text-text-dim">(switch demo role to Executor or Admin)</span>}
        </p>
        <p className="mt-2 text-xs text-text-dim">Rollback rule (auto-reverts if breached):</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-text-dim" htmlFor="rb-below">
              ROAS below
            </label>
            <input
              id="rb-below"
              type="number"
              value={rollbackBelow}
              onChange={(e) => setRollbackBelow(e.target.value)}
              className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
            />
          </div>
          <div>
            <label className="text-xs text-text-dim" htmlFor="rb-days">
              Within days
            </label>
            <input
              id="rb-days"
              type="number"
              value={rollbackDays}
              onChange={(e) => setRollbackDays(e.target.value)}
              className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!canExecute || executeMutation.isPending}
          onClick={() =>
            executeMutation.mutate({
              metric: 'ROAS',
              channel: decision.params.to ?? decision.params.channel ?? '',
              below: Number(rollbackBelow),
              afterDays: Number(rollbackDays),
            })
          }
        >
          Execute
        </Button>
      </div>
    );
  }

  if (decision.status === 'LIVE') {
    const canExecute = EXECUTOR_ROLES.includes(demoRole);
    return (
      <div className="rounded-btn border border-card-border bg-card p-4">
        <p className="text-sm font-medium text-text">Live — being tracked against its promise.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="destructive" disabled={!canExecute || rollbackMutation.isPending} onClick={() => rollbackMutation.mutate()}>
            Trigger rollback
          </Button>
          {workspace === 'DEMO' && (
            <Button variant="secondary" disabled={simulateMutation.isPending} onClick={() => simulateMutation.mutate()}>
              Fast-forward 7 days (demo)
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
