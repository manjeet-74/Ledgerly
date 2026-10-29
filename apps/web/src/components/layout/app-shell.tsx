'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { MobileDrawer } from './mobile-drawer';
import { Topbar } from './topbar';
import { Footer } from './footer';

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
