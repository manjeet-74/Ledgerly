import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import type { Metric, Workspace } from '@ledgerly/shared';
import { mulberry32, round2 } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestActor } from '../../common/types';
import {
  normalizeRowKeys,
  REQUIRED_HEADERS,
  validateRows,
  type ValidatedMetricRow,
} from './csv-rows';

const MAX_ROWS = 100_000;
const BATCH_SIZE = 500;

export interface UploadResult {
  uploadId: string;
  rowsOk: number;
  rowsBad: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class DataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Parses a CSV buffer into lower-cased-key plain objects, checking required headers up front. */
  private parseCsv(buffer: Buffer): Array<Record<string, unknown>> {
    const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Array<
      Record<string, unknown>
    >;
    const normalized = records.map(normalizeRowKeys);

    if (normalized.length > 0) {
      const presentHeaders = new Set(Object.keys(normalized[0]!));
      const missing = REQUIRED_HEADERS.filter((h) => !presentHeaders.has(h));
      if (missing.length > 0) {
        throw new BadRequestException(`Missing required column(s): ${missing.join(', ')}`);
      }
    }

    if (normalized.length > MAX_ROWS) {
      throw new BadRequestException(`File has ${normalized.length} rows; max is ${MAX_ROWS}.`);
    }

    return normalized;
  }

  private async upsertRows(workspace: Workspace, rawRows: ValidatedMetricRow[], uploadId: string | null) {
    // Postgres rejects an ON CONFLICT upsert that targets the same row twice
    // within one statement ("command cannot affect row a second time") --
    // so if the same (date, channel) appears more than once in this batch
    // (e.g. a CSV with an accidental duplicate line), keep only the last
    // occurrence before building the VALUES list. "Last wins" matches what
    // a second upload of the same file would do anyway.
    const dedupedByKey = new Map<string, ValidatedMetricRow>();
    for (const row of rawRows) {
      dedupedByKey.set(`${row.date}|${row.channel}`, row);
    }
    const rows = Array.from(dedupedByKey.values());

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = batch.map(
        (r) => Prisma.sql`(
          ${randomUUID()}, ${workspace}::"Workspace", ${r.date}::date, ${r.channel},
          ${r.spend}, ${r.revenue}, ${r.impressions}, ${r.clicks}, ${r.conversions}, ${uploadId}
        )`,
      );
      await this.prisma.$executeRaw`
        INSERT INTO "MetricRow" (id, workspace, date, channel, spend, revenue, impressions, clicks, conversions, "uploadId")
        VALUES ${Prisma.join(values)}
        ON CONFLICT (workspace, date, channel) DO UPDATE SET
          spend = EXCLUDED.spend,
          revenue = EXCLUDED.revenue,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          conversions = EXCLUDED.conversions,
          "uploadId" = EXCLUDED."uploadId"
      `;
    }
  }

  async upload(
    workspace: Workspace,
    filename: string,
    buffer: Buffer,
    actor: RequestActor,
  ): Promise<UploadResult> {
    const rawRows = this.parseCsv(buffer);
    const { validRows, errors, rowsOk, rowsBad } = validateRows(rawRows);

    const upload = await this.prisma.upload.create({
      data: {
        workspace,
        filename,
        rowsOk,
        rowsBad,
        errors: errors as unknown as Prisma.InputJsonValue,
        createdBy: actor.name,
      },
    });

    await this.upsertRows(workspace, validRows, upload.id);

    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'DATA_UPLOADED',
        actorName: actor.name,
        actorRole: actor.role,
        message: `Uploaded ${filename}: ${rowsOk} rows ok, ${rowsBad} rejected.`,
        data: { uploadId: upload.id, filename, rowsOk, rowsBad },
      }),
    );

    return { uploadId: upload.id, rowsOk, rowsBad, errors };
  }

  async ingest(workspace: Workspace, rows: Array<Record<string, unknown>>): Promise<UploadResult> {
    if (rows.length > 1000) {
      throw new BadRequestException('Ingest accepts at most 1000 rows per request.');
    }
    const { validRows, errors, rowsOk, rowsBad } = validateRows(rows);
    await this.upsertRows(workspace, validRows, null);

    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'DATA_UPLOADED',
        actorName: 'Ingest API',
        actorRole: 'SYSTEM',
        message: `Ingested via webhook: ${rowsOk} rows ok, ${rowsBad} rejected.`,
        data: { rowsOk, rowsBad },
      }),
    );

    return { uploadId: '', rowsOk, rowsBad, errors };
  }

  async getMetrics(workspace: Workspace, from?: string, to?: string, channel?: string) {
    return this.prisma.metricRow.findMany({
      where: {
        workspace,
        ...(from || to
          ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
        ...(channel ? { channel } : {}),
      },
      orderBy: [{ date: 'asc' }, { channel: 'asc' }],
    });
  }

  async getSummary(workspace: Workspace) {
    const rows = await this.prisma.metricRow.findMany({ where: { workspace } });

    const byChannel = new Map<string, { spend: number; revenue: number }>();
    const byDate = new Map<string, { spend: number; revenue: number }>();

    for (const row of rows) {
      const spend = Number(row.spend);
      const revenue = Number(row.revenue);
      const dateKey = row.date.toISOString().slice(0, 10);

      const c = byChannel.get(row.channel) ?? { spend: 0, revenue: 0 };
      c.spend += spend;
      c.revenue += revenue;
      byChannel.set(row.channel, c);

      const d = byDate.get(dateKey) ?? { spend: 0, revenue: 0 };
      d.spend += spend;
      d.revenue += revenue;
      byDate.set(dateKey, d);
    }

    const channels = Array.from(byChannel.entries())
      .map(([channel, v]) => ({
        channel,
        spend: round2(v.spend),
        revenue: round2(v.revenue),
        roas: v.spend > 0 ? round2(v.revenue / v.spend) : 0,
      }))
      .sort((a, b) => a.channel.localeCompare(b.channel));

    const daily = Array.from(byDate.entries())
      .map(([date, v]) => ({
        date,
        spend: round2(v.spend),
        revenue: round2(v.revenue),
        roas: v.spend > 0 ? round2(v.revenue / v.spend) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { channels, daily };
  }

  /** A deterministic 90-day, 3-channel CSV anyone can download and re-upload to try LIVE mode. */
  generateSampleCsv(): string {
    const rand = mulberry32(20260101);
    const channels: Array<{ name: string; baseSpend: number; baseRoas: number }> = [
      { name: 'Google Search', baseSpend: 1200, baseRoas: 4.2 },
      { name: 'Meta Ads', baseSpend: 900, baseRoas: 2.6 },
      { name: 'Email', baseSpend: 150, baseRoas: 7.5 },
    ];

    const today = new Date();
    const rowsOut: string[] = ['date,channel,spend,revenue,impressions,clicks,conversions'];

    for (let dayIndex = 89; dayIndex >= 0; dayIndex -= 1) {
      const date = new Date(today.getTime() - (dayIndex + 1) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      for (const ch of channels) {
        const spend = round2(ch.baseSpend * (0.9 + 0.2 * rand()));
        const roas = round2(ch.baseRoas * (0.9 + 0.2 * rand()));
        const revenue = round2(spend * roas);
        const clicks = Math.round(spend / 1.2);
        const impressions = Math.round(clicks * 30);
        const conversions = Math.round(revenue / 80);
        rowsOut.push(`${date},${ch.name},${spend},${revenue},${impressions},${clicks},${conversions}`);
      }
    }

    return rowsOut.join('\n');
  }

  metricsFromRows(rows: Array<{ date: Date; channel: string; spend: Prisma.Decimal; revenue: Prisma.Decimal; impressions: number; clicks: number; conversions: number }>): Metric[] {
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      channel: r.channel,
      spend: Number(r.spend),
      revenue: Number(r.revenue),
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
    }));
  }
}
