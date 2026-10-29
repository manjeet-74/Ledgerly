'use client';

import { Menu } from 'lucide-react';
import { ModeToggle } from './mode-toggle';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-card-border bg-bg/80 px-4 py-3 backdrop-blur md:min-h-[64px] md:flex-nowrap md:gap-4 md:px-6 print:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-text-dim hover:text-text md:hidden"
      >
        <Menu size={22} />
      </button>
      <div className="hidden flex-1 md:block" />
      <ModeToggle />
    </header>
  );
}
