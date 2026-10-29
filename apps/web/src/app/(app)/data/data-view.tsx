'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UploadCloud, PlayCircle } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { downloadFromApi } from '@/lib/download';
import { useMode } from '@/lib/mode';
import { pageFadeRise } from '@/lib/motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UploadResult {
  uploadId: string;
  rowsOk: number;
  rowsBad: number;
  errors: Array<{ row: number; message: string }>;
}

interface Summary {
  channels: Array<{ channel: string; spend: number; revenue: number; roas: number }>;
}

const INGEST_CURL = `curl -X POST http://localhost:4000/data/ingest \\
  -H "X-Workspace: LIVE" \\
  -H "X-Ingest-Key: <your INGEST_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"rows":[{"date":"2026-10-28","channel":"Google Search","spend":1200,"revenue":5000,"impressions":30000,"clicks":1000,"conversions":62}]}'`;

export function DataView() {
  const { workspace } = useMode();
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summaryQuery = useQuery({
    queryKey: ['data', 'summary'],
    queryFn: () => apiFetch<Summary>('/data/summary'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<UploadResult>('/data/upload', { method: 'POST', body: form });
    },
    onSuccess: (result) => {
      toast.success(`Uploaded: ${result.rowsOk} rows ok, ${result.rowsBad} rejected.`);
      qc.invalidateQueries({ queryKey: ['data'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Upload failed.'),
  });

  const engineMutation = useMutation({
    mutationFn: () => apiFetch<{ created: number; skipped: number; droppedByRules: number }>('/engine/run', { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`Engine run: ${res.created} created, ${res.skipped} skipped.`);
      qc.invalidateQueries({ queryKey: ['decisions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Engine run failed.'),
  });

  const canUpload = workspace === 'LIVE';

  const handleFile = (file: File) => {
    if (!canUpload) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Only .csv files are accepted.');
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Data</h1>
        <p className="mt-1 text-sm text-text-dim">Upload marketing performance data, or send it over the ingest webhook.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
        </CardHeader>

        {!canUpload && (
          <p className="mb-3 text-sm text-text-dim">
            Upload is disabled in DEMO — the demo workspace already has a deterministic 90-day dataset.
            Switch to LIVE and sign in to upload your own data.
          </p>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (canUpload) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-btn border-2 border-dashed p-8 text-center transition-colors',
            canUpload ? 'border-card-border hover:border-brand' : 'border-card-border opacity-50',
            dragOver && 'border-brand bg-brand/5',
          )}
        >
          <UploadCloud size={28} className="text-text-dim" aria-hidden />
          <p className="text-sm text-text-dim">Drag and drop a .csv file here, or</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            disabled={!canUpload}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="secondary" size="sm" disabled={!canUpload || uploadMutation.isPending} onClick={() => fileInputRef.current?.click()}>
            Choose file
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => downloadFromApi('/data/sample-csv', 'ledgerly-sample.csv')}>
            Download sample CSV
          </Button>
          <Button disabled={engineMutation.isPending} onClick={() => engineMutation.mutate()}>
            <PlayCircle size={16} aria-hidden />
            Run engine
          </Button>
        </div>

        {uploadMutation.data && uploadMutation.data.errors.length > 0 && (
          <div className="mt-4 rounded-btn border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            <p className="font-medium">{uploadMutation.data.rowsBad} row(s) rejected:</p>
            <ul className="mt-1 list-inside list-disc">
              {uploadMutation.data.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current summary by channel</CardTitle>
        </CardHeader>
        {!summaryQuery.data && <Skeleton className="h-32 w-full" />}
        {summaryQuery.data && (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs text-text-dim">
                <th className="pb-2">Channel</th>
                <th className="pb-2">Spend</th>
                <th className="pb-2">Revenue</th>
                <th className="pb-2">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {summaryQuery.data.channels.map((c) => (
                <tr key={c.channel}>
                  <td className="py-2 text-text">{c.channel}</td>
                  <td className="py-2 font-mono text-text-dim">{formatCurrency(c.spend)}</td>
                  <td className="py-2 font-mono text-text-dim">{formatCurrency(c.revenue)}</td>
                  <td className="py-2 font-mono text-text-dim">{c.roas.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingest webhook</CardTitle>
        </CardHeader>
        <p className="text-sm text-text-dim">
          Send rows programmatically with an ingest key (LIVE only). Never commit the key — it lives in
          the API's <code className="font-mono text-xs">.env</code> as <code className="font-mono text-xs">INGEST_API_KEY</code>.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-bg-elev p-3 font-mono text-xs text-text-dim">{INGEST_CURL}</pre>
      </Card>
    </motion.div>
  );
}
