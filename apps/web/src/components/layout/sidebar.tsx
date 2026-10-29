'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, ShieldCheck, Calculator, Database, ScrollText } from 'lucide-react';
import { site } from '@/content/site';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/decisions': ListChecks,
  '/audit': ScrollText,
  '/trust': ShieldCheck,
  '/roi': Calculator,
  '/data': Database,
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {site.nav.map((item) => {
        const Icon = ICONS[item.href] ?? LayoutDashboard;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors',
              active ? 'bg-brand/15 text-brand-2' : 'text-text-dim hover:bg-card hover:text-text',
            )}
          >
            <Icon size={18} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col gap-6 border-r border-card-border bg-bg-elev p-5 md:flex print:hidden">
      <Link href="/" className="flex items-center gap-2 text-lg font-display font-semibold">
        <span className="inline-block h-2 w-2 rounded-full bg-brand-2" aria-hidden />
        {site.name}
      </Link>
      <SidebarNav />
    </aside>
  );
}
