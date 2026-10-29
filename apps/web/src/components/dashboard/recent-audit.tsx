'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';

export interface AuditRow {
  id: string;
  seq: number;
  type: string;
  actorName: string;
  message: string;
  createdAt: string;
}

export function RecentAudit({ events }: { events?: AuditRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent audit events</CardTitle>
        <Link href="/audit" className="text-xs font-medium text-brand-2 hover:underline">
          View all
        </Link>
      </CardHeader>

      {!events && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {events && events.length === 0 && <p className="py-6 text-center text-sm text-text-dim">No audit events yet.</p>}

      {events && events.length > 0 && (
        <ul className="divide-y divide-card-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="font-mono text-xs text-text-dim">#{e.seq}</span>
              <span className="min-w-0 flex-1 truncate text-text">{e.message}</span>
              <span className="shrink-0 text-xs text-text-dim">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
