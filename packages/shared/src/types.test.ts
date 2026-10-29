import { describe, expect, it } from 'vitest';
import { canTransition, type DecisionStatus } from './types';

const ALL: DecisionStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'LIVE',
  'COMPLETED',
  'REJECTED',
  'ROLLED_BACK',
];

describe('canTransition', () => {
  it('allows every legal transition', () => {
    expect(canTransition('PENDING_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransition('PENDING_REVIEW', 'REJECTED')).toBe(true);
    expect(canTransition('APPROVED', 'LIVE')).toBe(true);
    expect(canTransition('LIVE', 'COMPLETED')).toBe(true);
    expect(canTransition('LIVE', 'ROLLED_BACK')).toBe(true);
  });

  it('blocks a sample of illegal transitions', () => {
    expect(canTransition('PENDING_REVIEW', 'LIVE')).toBe(false);
    expect(canTransition('APPROVED', 'COMPLETED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('COMPLETED', 'LIVE')).toBe(false);
    expect(canTransition('ROLLED_BACK', 'LIVE')).toBe(false);
  });

  it('never allows a terminal state to transition anywhere', () => {
    for (const terminal of ['COMPLETED', 'REJECTED', 'ROLLED_BACK'] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });
});
