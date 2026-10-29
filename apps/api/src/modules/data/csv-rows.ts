import { z } from 'zod';

export const REQUIRED_HEADERS = ['date', 'channel', 'spend', 'revenue'] as const;

/**
 * One validated, upload-ready metric row. Numbers arrive from CSV as
 * strings and from JSON ingest as numbers -- `z.coerce.number()` accepts
 * both, which is why this one schema validates both code paths (upload and
 * webhook ingest) instead of needing two near-duplicate schemas.
 */
export const metricRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  channel: z.string().min(1).max(60),
  spend: z.coerce.number().min(0),
  revenue: z.coerce.number().min(0),
  impressions: z.coerce.number().int().min(0).optional().default(0),
  clicks: z.coerce.number().int().min(0).optional().default(0),
  conversions: z.coerce.number().int().min(0).optional().default(0),
});

export type ValidatedMetricRow = z.infer<typeof metricRowSchema>;

export interface RowError {
  row: number; // 1-based, matching a spreadsheet's row numbers (header is row 1)
  message: string;
}

export interface ValidationResult {
  validRows: ValidatedMetricRow[];
  errors: RowError[];
  rowsOk: number;
  rowsBad: number;
}

const MAX_ERRORS = 50;

/**
 * Validates every row independently (one bad row never blocks the good
 * ones) and caps recorded errors at 50 -- past that point the file is
 * clearly malformed and listing every remaining row adds nothing the
 * uploader needs for the first fix.
 */
export function validateRows(rawRows: Array<Record<string, unknown>>): ValidationResult {
  const validRows: ValidatedMetricRow[] = [];
  const errors: RowError[] = [];

  rawRows.forEach((raw, i) => {
    const result = metricRowSchema.safeParse(raw);
    if (result.success) {
      validRows.push(result.data);
    } else if (errors.length < MAX_ERRORS) {
      const message = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      errors.push({ row: i + 2, message }); // +2: 1-based + header row
    }
  });

  return { validRows, errors, rowsOk: validRows.length, rowsBad: rawRows.length - validRows.length };
}

/** Lower-cases every key of a parsed CSV row so header casing (Date, DATE, date) doesn't matter. */
export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.trim().toLowerCase()] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
}
