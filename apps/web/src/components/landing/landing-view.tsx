'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, ListChecks, GitBranch, Calculator, ScrollText, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { pageFadeRise, staggerContainer, staggerItem, cardHover } from '@/lib/motion';
import { site } from '@/content/site';

const FEATURES = [
  {
    icon: ScrollText,
    title: 'Tamper-evident audit trail',
    body: 'Every decision, approval, and execution is chained with SHA-256 hashes. Alter one event and the chain breaks visibly.',
  },
  {
    icon: GitBranch,
    title: 'Evidence chain',
    body: '"Show the math" on every recommendation -- the rules, the data, and the confidence score that produced it.',
  },
  {
    icon: ListChecks,
    title: 'Role-gated approval',
    body: 'Spend tiers route to the right people. Marketing recommends, finance caps the spend, an executor commits it live.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust Center',
    body: 'Seven live controls -- audit integrity, RBAC coverage, spend-cap enforcement -- checked against real system state, not slides.',
  },
  {
    icon: Calculator,
    title: 'ROI calculator',
    body: 'Model the payoff of a reallocation before you approve it, using the same formulas the engine uses.',
  },
];

export function LandingView() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6 py-20 text-center">
      <motion.div initial="hidden" animate="visible" variants={pageFadeRise}>
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{site.name}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-dim">{site.tagline}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-btn bg-brand px-6 font-medium text-white transition-colors hover:bg-brand/90 active:scale-[0.97]"
          >
            Open Demo
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-btn border border-card-border bg-card px-6 font-medium text-text transition-colors hover:bg-bg-elev active:scale-[0.97]"
          >
            Use my data
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={pageFadeRise}
        transition={{ delay: 0.15 }}
        className="glass-card mt-16 w-full max-w-2xl p-6 text-left"
        aria-hidden
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Decision preview</span>
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">ANOMALY_ALERT</span>
        </div>
        <p className="mt-3 font-mono text-sm text-text">Meta Ads ROAS dropped 45% below its 90-day normal</p>
        <motion.div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-card-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div
            className="h-full rounded-full bg-brand-2"
            initial={{ width: '0%' }}
            animate={{ width: '87%' }}
            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
          />
        </motion.div>
        <p className="mt-2 font-mono text-xs text-text-dim">confidence 0.87</p>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="mt-16 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <motion.div key={f.title} variants={staggerItem} {...cardHover}>
              <Card className="h-full text-left">
                <Icon size={22} className="text-brand-2" aria-hidden />
                <h2 className="mt-3 font-display text-base font-semibold text-text">{f.title}</h2>
                <p className="mt-2 text-sm text-text-dim">{f.body}</p>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </main>
  );
}
