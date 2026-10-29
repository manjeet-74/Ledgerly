'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ChainBlock {
  seq: number;
  type: string;
}

export function ChainStrip({
  blocks,
  brokenAtSeq,
  shakeKey,
}: {
  blocks: ChainBlock[];
  brokenAtSeq?: number;
  shakeKey?: number;
}) {
  const visible = blocks.slice(-60);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-1">
        {visible.map((b) => {
          const isBroken = brokenAtSeq !== undefined && b.seq === brokenAtSeq;
          const isAfterBreak = brokenAtSeq !== undefined && b.seq > brokenAtSeq;
          return (
            <motion.div
              key={b.seq}
              title={`#${b.seq} ${b.type}`}
              animate={isBroken && shakeKey ? { x: [0, -4, 4, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={cn(
                'h-8 w-3 shrink-0 rounded-sm border',
                isBroken && 'border-bad bg-bad',
                isAfterBreak && !isBroken && 'border-warn/50 border-dashed bg-warn/20',
                !isBroken && !isAfterBreak && 'border-ok/40 bg-ok/20',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
