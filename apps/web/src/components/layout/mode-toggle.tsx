'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, Workspace } from '@ledgerly/shared';
import { useMode } from '@/lib/mode';
import { cn } from '@/lib/utils';
import { apiFetch, clearAuthToken } from '@/lib/api';

const ROLES: Role[] = ['ADMIN', 'MARKETING_DIRECTOR', 'FINANCE', 'EXECUTOR', 'AUDITOR', 'VIEWER'];
const WORKSPACES: Workspace[] = ['DEMO', 'LIVE'];

interface Me {
  name: string;
  role: Role;
}

function hasToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem('ledgerly.token'));
  } catch {
    return false;
  }
}

export function ModeToggle() {
  const { workspace, setWorkspace, demoRole, setDemoRole } = useMode();
  const router = useRouter();
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<Me>('/auth/me'),
    enabled: workspace === 'LIVE' && hasToken(),
    retry: false,
  });

  const handleWorkspaceClick = (w: Workspace) => {
    if (w === 'LIVE' && !hasToken()) {
      router.push('/login');
      return;
    }
    setWorkspace(w);
  };

  const handleLogout = () => {
    clearAuthToken();
    qc.removeQueries({ queryKey: ['auth', 'me'] });
    setWorkspace('DEMO');
    router.push('/');
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
      <div
        role="radiogroup"
        aria-label="Workspace mode"
        className="flex shrink-0 items-center rounded-full border border-card-border bg-card p-1"
      >
        {WORKSPACES.map((w) => (
          <button
            key={w}
            role="radio"
            aria-checked={workspace === w}
            onClick={() => handleWorkspaceClick(w)}
            className={cn(
              'min-h-[32px] rounded-full px-2.5 text-xs font-semibold tracking-wide transition-colors sm:px-3',
              workspace === w
                ? w === 'DEMO'
                  ? 'bg-warn text-black'
                  : 'bg-ok text-black'
                : 'text-text-dim hover:text-text',
            )}
          >
            {w}
            <span className="hidden sm:inline"> DATA</span>
          </button>
        ))}
      </div>

      {workspace === 'DEMO' && (
        <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-text-dim">
          <span className="hidden sm:inline">Viewing as</span>
          <select
            aria-label="Demo role"
            value={demoRole}
            onChange={(e) => setDemoRole(e.target.value as Role)}
            className="min-h-[36px] max-w-[9rem] rounded-btn border border-card-border bg-card px-2 text-text sm:max-w-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      )}

      {workspace === 'LIVE' && meQuery.data && (
        <div className="flex min-w-0 shrink-0 items-center gap-2 text-xs text-text-dim">
          <span className="max-w-[8rem] truncate sm:max-w-none">
            {meQuery.data.name} · <span className="text-text">{meQuery.data.role.replace('_', ' ')}</span>
          </span>
          <button onClick={handleLogout} className="min-h-[32px] shrink-0 rounded-btn px-2 font-medium text-brand-2 hover:underline">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
