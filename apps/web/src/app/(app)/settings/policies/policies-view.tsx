'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { useMode } from '@/lib/mode';
import { pageFadeRise } from '@/lib/motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Step = 'MARKETING' | 'FINANCE' | 'EXECUTIVE';

interface Tier {
  maxAmount: number | null;
  steps: Step[];
}

interface Policy {
  tiers: Tier[];
  engine: Record<string, number>;
  updatedAt: string;
}

const ALL_STEPS: Step[] = ['MARKETING', 'FINANCE', 'EXECUTIVE'];

export function PoliciesView() {
  const { workspace, demoRole } = useMode();
  const qc = useQueryClient();
  const [tiers, setTiers] = useState<Tier[] | null>(null);

  const canEdit = workspace === 'LIVE' || demoRole === 'ADMIN';

  const query = useQuery({
    queryKey: ['policies'],
    queryFn: () => apiFetch<Policy>('/policies'),
  });

  useEffect(() => {
    if (query.data && !tiers) setTiers(query.data.tiers);
  }, [query.data, tiers]);

  const saveMutation = useMutation({
    mutationFn: (next: Tier[]) => apiFetch('/policies', { method: 'PUT', body: JSON.stringify({ tiers: next }) }),
    onSuccess: () => {
      toast.success('Policy saved — new decisions will use these tiers.');
      qc.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed.'),
  });

  if (!tiers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const updateTier = (i: number, patch: Partial<Tier>) => {
    setTiers((prev) => prev!.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const toggleStep = (i: number, step: Step) => {
    const tier = tiers[i]!;
    const steps = tier.steps.includes(step) ? tier.steps.filter((s) => s !== step) : [...tier.steps, step];
    updateTier(i, { steps });
  };

  const removeTier = (i: number) => setTiers((prev) => prev!.filter((_, idx) => idx !== i));
  const addTier = () => setTiers((prev) => [...prev!, { maxAmount: 0, steps: ['MARKETING'] }]);

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Policies</h1>
        <p className="mt-1 text-sm text-text-dim">
          Spend tiers decide which approval steps a new decision needs. Only ADMIN can edit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approval tiers ({workspace})</CardTitle>
        </CardHeader>

        {!canEdit && (
          <p className="mb-3 text-xs text-text-dim">Switch demo role to Admin (or sign in as an admin in LIVE) to edit.</p>
        )}

        <div className="space-y-3">
          {tiers.map((tier, i) => (
            <div key={i} className="rounded-btn border border-card-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-text-dim">
                  Up to
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={tier.maxAmount ?? ''}
                    placeholder="no limit"
                    onChange={(e) => updateTier(i, { maxAmount: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-28 rounded-btn border border-card-border bg-bg-elev px-2 py-1 text-sm text-text"
                  />
                  <span>$ (blank = no limit)</span>
                </label>
                <button
                  disabled={!canEdit}
                  onClick={() => removeTier(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-btn text-text-dim hover:bg-bg-elev hover:text-bad disabled:opacity-40"
                  aria-label="Remove tier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 sm:gap-4">
                {ALL_STEPS.map((step) => (
                  <label key={step} className="flex items-center gap-1.5 text-sm text-text">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={tier.steps.includes(step)}
                      onChange={() => toggleStep(i, step)}
                    />
                    {step}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" disabled={!canEdit} onClick={addTier}>
            <Plus size={14} aria-hidden />
            Add tier
          </Button>
          <Button disabled={!canEdit || saveMutation.isPending} onClick={() => saveMutation.mutate(tiers)}>
            Save
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
