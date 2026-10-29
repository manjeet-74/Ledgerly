'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Printer } from 'lucide-react';
import { calculateRoi } from '@ledgerly/shared';
import { pageFadeRise } from '@/lib/motion';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { formatCurrency } from '@/lib/format';

export function RoiView() {
  const [monthlyAdSpend, setMonthlyAdSpend] = useState(50000);
  const [analystHoursPerWeek, setAnalystHoursPerWeek] = useState(10);
  const [hourlyCost, setHourlyCost] = useState(60);
  const [wastePct, setWastePct] = useState(12);
  const [recoveryPct, setRecoveryPct] = useState(25);
  const [timeSavedPct, setTimeSavedPct] = useState(60);
  const [monthlyPlatformCost, setMonthlyPlatformCost] = useState(499);

  const result = useMemo(
    () =>
      calculateRoi({
        monthlyAdSpend,
        analystHoursPerWeek,
        hourlyCost,
        wastePct,
        recoveryPct,
        timeSavedPct,
        monthlyPlatformCost,
      }),
    [monthlyAdSpend, analystHoursPerWeek, hourlyCost, wastePct, recoveryPct, timeSavedPct, monthlyPlatformCost],
  );

  const chartData = [
    { name: 'Spend recovered', value: result.spendRecovered },
    { name: 'Labor saved', value: result.laborSaved },
    { name: 'Platform cost', value: -monthlyPlatformCost },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">ROI Calculator</h1>
          <p className="mt-1 text-sm text-text-dim">
            Uses the exact same formula the decision engine runs on the backend — the number here can
            never drift from what the API would compute.
          </p>
        </div>
        <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          Print
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <div className="space-y-5">
            <Slider label="Monthly ad spend" value={monthlyAdSpend} onChange={setMonthlyAdSpend} min={0} max={500000} step={1000} format={formatCurrency} />
            <Slider label="Analyst hours / week" value={analystHoursPerWeek} onChange={setAnalystHoursPerWeek} min={0} max={40} format={(v) => `${v}h`} />
            <Slider label="Hourly cost" value={hourlyCost} onChange={setHourlyCost} min={0} max={200} format={formatCurrency} />
            <Slider label="Wasted spend %" value={wastePct} onChange={setWastePct} min={0} max={50} format={(v) => `${v}%`} />
            <Slider label="Recovery rate %" value={recoveryPct} onChange={setRecoveryPct} min={0} max={100} format={(v) => `${v}%`} />
            <Slider label="Time saved %" value={timeSavedPct} onChange={setTimeSavedPct} min={0} max={100} format={(v) => `${v}%`} />
            <Slider label="Monthly platform cost" value={monthlyPlatformCost} onChange={setMonthlyPlatformCost} min={0} max={5000} step={50} format={formatCurrency} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly results</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-4">
              <Result label="Spend recovered" value={result.spendRecovered} />
              <Result label="Hours saved" value={result.hoursSaved} suffix="h" />
              <Result label="Labor saved" value={result.laborSaved} />
              <Result label="Net monthly benefit" value={result.netMonthly} highlight />
              <Result label="Annual net" value={result.annualNet} highlight />
              <Result label="Payback (months)" value={result.paybackMonths} raw />
            </div>
          </Card>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Where the benefit comes from</CardTitle>
            </CardHeader>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis type="number" stroke="#9aa4bd" fontSize={11} tickFormatter={(v: number) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="name" stroke="#9aa4bd" fontSize={11} width={110} />
                  <Tooltip
                    contentStyle={{ background: '#111726', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" fill="#6d7cff" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function Result({ label, value, suffix, highlight, raw }: { label: string; value: number; suffix?: string; highlight?: boolean; raw?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-dim">{label}</p>
      <p className={highlight ? 'mt-1 font-mono text-xl font-semibold text-brand-2' : 'mt-1 font-mono text-lg text-text'}>
        <CountUp value={value} format={(n) => (raw ? n.toFixed(1) : suffix ? `${Math.round(n)}${suffix}` : formatCurrency(n))} />
      </p>
    </div>
  );
}
