'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { site } from '@/content/site';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24" role="dialog" aria-modal="true" aria-label="Command palette">
      <button aria-label="Close command palette" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
      <Command className="relative w-full max-w-md overflow-hidden rounded-card border border-card-border bg-bg-elev shadow-2xl">
        <div className="flex items-center gap-2 border-b border-card-border px-3">
          <Search size={16} className="text-text-dim" aria-hidden />
          <Command.Input
            autoFocus
            placeholder="Jump to…"
            className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-dim"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-text-dim">No matching page.</Command.Empty>
          {site.nav.map((item) => (
            <Command.Item
              key={item.href}
              onSelect={() => go(item.href)}
              className="min-h-[40px] cursor-pointer rounded-btn px-3 py-2 text-sm text-text data-[selected=true]:bg-card"
            >
              {item.label}
            </Command.Item>
          ))}
          <Command.Item onSelect={() => go('/')} className="min-h-[40px] cursor-pointer rounded-btn px-3 py-2 text-sm text-text data-[selected=true]:bg-card">
            Home
          </Command.Item>
        </Command.List>
      </Command>
    </div>
  );
}
