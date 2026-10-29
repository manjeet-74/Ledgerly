'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role, Workspace } from '@ledgerly/shared';

interface ModeContextValue {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  demoRole: Role;
  setDemoRole: (r: Role) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

const WORKSPACE_KEY = 'ledgerly.workspace';
const DEMO_ROLE_KEY = 'ledgerly.demoRole';

/** Reads localStorage defensively -- a private window, blocked storage, or SSR (no `window` at all) must never crash the app, just fall back to the default. */
function readStorage<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return (value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Per-viewer convenience only; silently ignored when storage is unavailable.
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspaceState] = useState<Workspace>('DEMO');
  const [demoRole, setDemoRoleState] = useState<Role>('ADMIN');

  useEffect(() => {
    setWorkspaceState(readStorage<Workspace>(WORKSPACE_KEY, 'DEMO'));
    setDemoRoleState(readStorage<Role>(DEMO_ROLE_KEY, 'ADMIN'));
  }, []);

  const setWorkspace = (w: Workspace) => {
    setWorkspaceState(w);
    writeStorage(WORKSPACE_KEY, w);
  };
  const setDemoRole = (r: Role) => {
    setDemoRoleState(r);
    writeStorage(DEMO_ROLE_KEY, r);
  };

  return (
    <ModeContext.Provider value={{ workspace, setWorkspace, demoRole, setDemoRole }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode() must be used inside <ModeProvider>.');
  return ctx;
}
