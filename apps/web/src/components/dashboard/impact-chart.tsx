'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

export interface DailyPoint {
  date: string;
  spend: number;
  revenue: number;
}

export function ImpactChart({ daily }: { daily?: DailyPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue vs. spend (90 days)</CardTitle>
      </CardHeader>

      {!daily && <Skeleton className="h-64 w-full" />}

      {daily && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="date"
                stroke="#9aa4bd"
                fontSize={11}
                tickFormatter={(v: string) => v.slice(5)}
                minTickGap={24}
              />
              <YAxis stroke="#9aa4bd" fontSize={11} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: '#111726', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                labelStyle={{ color: '#9aa4bd' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Line type="monotone" dataKey="revenue" stroke="#22d3ee" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="spend" stroke="#6d7cff" strokeWidth={2} dot={false} name="Spend" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
