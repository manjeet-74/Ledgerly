import { describe, expect, it } from 'vitest';
import { computeHash, GENESIS, type EventForHash, verifyChain } from './hash';

function makeEvent(seq: number, message: string): EventForHash {
  return {
    seq,
    type: 'DECISION_CREATED',
    actorName: 'System',
    actorRole: 'ADMIN',
    decisionId: null,
    message,
    data: { seq },
    createdAtIso: `2026-01-0${seq}T00:00:00.000Z`,
  };
}

function buildChain(messages: string[]) {
  let prevHash = GENESIS;
  const events = messages.map((message, i) => {
    const e = makeEvent(i + 1, message);
    const hash = computeHash(prevHash, e);
    const full = { ...e, prevHash, hash };
    prevHash = hash;
    return full;
  });
  return events;
}

describe('verifyChain', () => {
  it('accepts a valid chain', () => {
    const events = buildChain(['one', 'two', 'three']);
    expect(verifyChain(events)).toEqual({ ok: true });
  });

  it('detects a mutated message as HASH_MISMATCH', () => {
    const events = buildChain(['one', 'two', 'three']);
    events[1] = { ...events[1]!, message: 'tampered' };
    const result = verifyChain(events);
    expect(result).toEqual({ ok: false, brokenAtSeq: 2, reason: 'HASH_MISMATCH' });
  });

  it('detects a deleted middle event as SEQ_GAP', () => {
    const events = buildChain(['one', 'two', 'three']);
    const withGap = [events[0]!, events[2]!]; // remove seq 2
    const result = verifyChain(withGap);
    expect(result).toEqual({ ok: false, brokenAtSeq: 3, reason: 'SEQ_GAP' });
  });

  it('accepts an empty chain', () => {
    expect(verifyChain([])).toEqual({ ok: true });
  });
});
