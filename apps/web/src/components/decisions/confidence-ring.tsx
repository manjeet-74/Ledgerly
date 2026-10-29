'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function ConfidenceRing({ confidence, size = 72 }: { confidence: number; size?: number }) {
  const reduceMotion = useReducedMotion();
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, confidence));

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#22d3ee"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute font-mono text-sm font-semibold text-text">{Math.round(pct * 100)}%</span>
    </div>
  );
}
