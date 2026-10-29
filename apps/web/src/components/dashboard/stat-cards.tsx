'use client';

import { CountUp } from '@/components/ui/count-up';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

export interface DecisionStats {
  open: number;
  pendingReview: number;
  live: number;
  completed: number;
  rejected: number;
  rolledBack: number;
  totalExpectedImpact: number;
  avgConfidence: number;
  hitRate: number;
}

const TILES: Array<{
  key: keyof DecisionStats;
  label: string;
  format: (n: number) => string;
}> = [
  { key: 'open', label: 'Open decisions', format: (n) => String(Math.round(n)) },
  { key: 'pendingReview', label: 'Pending review', format: (n) => String(Math.round(n)) },
  { key: 'totalExpectedImpact', label: 'Expected weekly impact', format: formatCurrency },
  { key: 'avgConfidence', label: 'Avg. confidence', format: (n) => formatPercent(n) },
  { key: 'hitRate', label: 'Outcome hit rate', format: (n) => formatPercent(n) },
];

export function StatCards({ stats }: { stats?: DecisionStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map((tile) => (
        <Card key={tile.key}>
          <p className="text-xs font-medium text-text-dim">{tile.label}</p>
          {stats ? (
            <p className="mt-2 font-mono text-2xl font-semibold text-text">
              <CountUp value={stats[tile.key]} format={tile.format} />
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-20" />
          )}
        </Card>
      ))}
    </div>
  );
}
