import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/lib/format';

export interface Outcome {
  promised: string;
  delivered: string;
  confidenceBefore: number;
  confidenceAfter: number;
  note: string;
  recordedAt: string;
}

export function OutcomePanel({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) {
    return <p className="py-6 text-center text-sm text-text-dim">No outcome recorded yet — this decision hasn't completed its tracking window.</p>;
  }

  const promised = Number(outcome.promised);
  const delivered = Number(outcome.delivered);
  const ratio = promised > 0 ? delivered / promised : 0;
  const hit = ratio >= 0.8;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-text-dim">Promised</p>
          <p className="mt-1 font-mono text-lg text-text">{formatCurrency(promised)}</p>
        </div>
        <div>
          <p className="text-xs text-text-dim">Delivered</p>
          <p className="mt-1 font-mono text-lg text-text">{formatCurrency(delivered)}</p>
        </div>
        <div>
          <p className="text-xs text-text-dim">Delivery ratio</p>
          <p className="mt-1 font-mono text-lg text-text">{formatPercent(ratio)}</p>
        </div>
        <div>
          <p className="text-xs text-text-dim">Result</p>
          <Badge tone={hit ? 'ok' : 'bad'} className="mt-1">
            {hit ? 'Hit' : 'Missed'}
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-dim">Confidence before</p>
          <p className="mt-1 font-mono text-sm text-text">{formatPercent(outcome.confidenceBefore)}</p>
        </div>
        <div>
          <p className="text-xs text-text-dim">Confidence after</p>
          <p className="mt-1 font-mono text-sm text-text">{formatPercent(outcome.confidenceAfter)}</p>
        </div>
      </div>
      <p className="text-sm text-text-dim">{outcome.note}</p>
    </div>
  );
}
