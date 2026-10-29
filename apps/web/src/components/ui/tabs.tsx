'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: Array<{ key: string; label: string; content: ReactNode }>;
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-card-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'min-h-[44px] rounded-t-btn px-4 text-sm font-medium transition-colors',
              active === t.key ? 'border-b-2 border-brand-2 text-text' : 'text-text-dim hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}
