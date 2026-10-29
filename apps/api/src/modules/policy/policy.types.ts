import type { ApprovalStep } from '@ledgerly/shared';

export interface PolicyTier {
  maxAmount: number | null;
  steps: ApprovalStep[];
}

export const DEFAULT_TIERS: PolicyTier[] = [
  { maxAmount: 1000, steps: ['MARKETING'] },
  { maxAmount: 10000, steps: ['MARKETING', 'FINANCE'] },
  { maxAmount: null, steps: ['MARKETING', 'FINANCE', 'EXECUTIVE'] },
];
