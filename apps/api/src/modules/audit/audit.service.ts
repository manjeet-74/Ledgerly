import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Workspace } from '@ledgerly/shared';
import { computeHash, GENESIS, verifyChain, type EventForHash } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppendAuditEventInput } from './audit.types';

export type TransactionClient = Prisma.TransactionClient;

export interface ChainVerifyReport {
  ok: boolean;
  total: number;
  brokenAtSeq?: number;
  reason?: 'PREV_MISMATCH' | 'HASH_MISMATCH' | 'SEQ_GAP';
  verifiedAt: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The ONLY way an AuditEvent should ever be created. Every state-changing
   * endpoint in the app calls this from inside its own `$transaction`, so
   * the business change and its audit record either both commit or both
   * roll back together -- there's no window where one happened and the
   * other didn't.
   *
   * Concurrency: a Postgres advisory lock scoped to this transaction
   * (`pg_advisory_xact_lock`, keyed by workspace) serializes every append
   * for that workspace. The plan describes this as "lock the latest event
   * FOR UPDATE", but a row lock can't protect the very FIRST event (there's
   * no row yet to lock) -- two concurrent transactions could both see an
   * empty table and both try to insert seq=1. An advisory lock has no such
   * gap: it locks the *workspace itself*, not a row, so it's held even
   * when zero rows exist yet. The unique index on (workspace, seq) is a
   * second line of defense in case this is ever bypassed.
   */
  async append(tx: TransactionClient, input: AppendAuditEventInput) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.workspace}))`;

    const rows = await tx.$queryRaw<Array<{ seq: number; hash: string }>>`
      SELECT seq, hash FROM "AuditEvent" WHERE workspace = ${input.workspace}::"Workspace"
      ORDER BY seq DESC LIMIT 1
    `;
    const last = rows[0];
    const seq = last ? last.seq + 1 : 1;
    const prevHash = last ? last.hash : GENESIS;
    const createdAt = new Date();
    const data = input.data ?? {};

    const eventForHash: EventForHash = {
      seq,
      type: input.type,
      actorName: input.actorName,
      actorRole: input.actorRole,
      decisionId: input.decisionId ?? null,
      message: input.message,
      data,
      createdAtIso: createdAt.toISOString(),
    };
    const hash = computeHash(prevHash, eventForHash);

    return tx.auditEvent.create({
      data: {
        workspace: input.workspace,
        seq,
        type: input.type,
        actorName: input.actorName,
        actorRole: input.actorRole,
        decisionId: input.decisionId ?? null,
        message: input.message,
        data: data as Prisma.InputJsonValue,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  async list(params: {
    workspace: Workspace;
    cursor?: number;
    limit?: number;
    decisionId?: string;
    type?: string;
    actor?: string;
  }) {
    const limit = Math.min(params.limit ?? 50, 200);
    return this.prisma.auditEvent.findMany({
      where: {
        workspace: params.workspace,
        ...(params.decisionId ? { decisionId: params.decisionId } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.actor ? { actorName: { contains: params.actor, mode: 'insensitive' } } : {}),
        ...(params.cursor ? { seq: { lt: params.cursor } } : {}),
      },
      orderBy: { seq: 'desc' },
      take: limit,
    });
  }

  private async loadChain(workspace: Workspace) {
    const events = await this.prisma.auditEvent.findMany({
      where: { workspace },
      orderBy: { seq: 'asc' },
    });
    return events.map((e) => ({
      seq: e.seq,
      type: e.type,
      actorName: e.actorName,
      actorRole: e.actorRole,
      decisionId: e.decisionId,
      message: e.message,
      data: e.data,
      createdAtIso: e.createdAt.toISOString(),
      prevHash: e.prevHash,
      hash: e.hash,
    }));
  }

  /** Verifies the chain and returns the report. Does NOT write the CHAIN_VERIFIED event itself -- callers append that themselves so they control the actor. */
  async verify(workspace: Workspace): Promise<ChainVerifyReport> {
    const chain = await this.loadChain(workspace);
    const result = verifyChain(chain);
    const verifiedAt = new Date().toISOString();

    if (result.ok) {
      return { ok: true, total: chain.length, verifiedAt };
    }
    return {
      ok: false,
      total: chain.length,
      brokenAtSeq: result.brokenAtSeq,
      reason: result.reason,
      verifiedAt,
    };
  }

  async exportEvents(workspace: Workspace, format: 'csv' | 'json') {
    const chain = await this.loadChain(workspace);
    if (format === 'json') {
      return JSON.stringify(chain, null, 2);
    }
    const header = 'seq,type,actorName,actorRole,decisionId,message,createdAtIso,prevHash,hash';
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = chain.map((e) =>
      [e.seq, e.type, e.actorName, e.actorRole, e.decisionId, e.message, e.createdAtIso, e.prevHash, e.hash]
        .map(escape)
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  /** DEMO only: mutate a random event's message WITHOUT fixing its hash, to demonstrate verify() catching it. Caller (controller) enforces the DEMO-only restriction. */
  async tamperRandomEvent(workspace: Workspace): Promise<{ tamperedSeq: number } | null> {
    const events = await this.prisma.auditEvent.findMany({
      where: { workspace },
      select: { id: true, seq: true },
    });
    if (events.length === 0) return null;

    const target = events[Math.floor(Math.random() * events.length)]!;
    await this.prisma.auditEvent.update({
      where: { id: target.id },
      data: { message: `[TAMPERED ${new Date().toISOString()}] This message was edited after the fact.` },
    });
    return { tamperedSeq: target.seq };
  }

  /** DEMO only: recompute every hash forward from seq 1 so the chain verifies again. */
  async repairChain(workspace: Workspace): Promise<ChainVerifyReport> {
    const chain = await this.loadChain(workspace);
    let prevHash = GENESIS;

    for (const e of chain) {
      const eventForHash: EventForHash = {
        seq: e.seq,
        type: e.type,
        actorName: e.actorName,
        actorRole: e.actorRole,
        decisionId: e.decisionId,
        message: e.message,
        data: e.data,
        createdAtIso: e.createdAtIso,
      };
      const hash = computeHash(prevHash, eventForHash);
      if (hash !== e.hash || prevHash !== e.prevHash) {
        await this.prisma.auditEvent.update({
          where: { workspace_seq: { workspace, seq: e.seq } },
          data: { prevHash, hash },
        });
      }
      prevHash = hash;
    }

    return this.verify(workspace);
  }
}
