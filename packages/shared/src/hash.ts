import { createHash } from 'crypto';

/** The fixed "previous hash" value for the very first event in a chain. */
export const GENESIS = 'GENESIS';

export interface EventForHash {
  seq: number;
  type: string;
  actorName: string;
  actorRole: string;
  decisionId: string | null;
  message: string;
  data: unknown;
  createdAtIso: string;
}

/**
 * Deterministic JSON stringify: sorts object keys recursively so the same
 * logical value always serializes to the exact same bytes, no matter what
 * order a database driver happens to hand back fields in. A hash is only
 * useful if two equal objects always hash to the same thing.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * One link in the chain: sha256(prevHash + "|" + canonicalJson(event)).
 * Because each event's hash depends on the PREVIOUS event's hash, changing
 * any field of any past event changes its hash, which no longer matches
 * what the next event recorded as `prevHash` — breaking the chain from that
 * point forward. That's what makes edits detectable.
 */
export function computeHash(prevHash: string, e: EventForHash): string {
  return createHash('sha256').update(`${prevHash}|${canonicalJson(e)}`).digest('hex');
}

export type ChainVerifyResult =
  | { ok: true }
  | { ok: false; brokenAtSeq: number; reason: 'PREV_MISMATCH' | 'HASH_MISMATCH' | 'SEQ_GAP' };

/**
 * Walks the chain in order and checks every link. Events must be sorted by
 * `seq` ascending before calling this.
 */
export function verifyChain(
  events: Array<EventForHash & { prevHash: string; hash: string }>,
): ChainVerifyResult {
  let expectedPrevHash = GENESIS;
  let expectedSeq = 1;

  for (const e of events) {
    if (e.seq !== expectedSeq) {
      return { ok: false, brokenAtSeq: e.seq, reason: 'SEQ_GAP' };
    }
    if (e.prevHash !== expectedPrevHash) {
      return { ok: false, brokenAtSeq: e.seq, reason: 'PREV_MISMATCH' };
    }
    const { prevHash, hash: storedHash, ...fields } = e;
    const recomputed = computeHash(prevHash, fields);
    if (recomputed !== storedHash) {
      return { ok: false, brokenAtSeq: e.seq, reason: 'HASH_MISMATCH' };
    }
    expectedPrevHash = e.hash;
    expectedSeq += 1;
  }

  return { ok: true };
}
