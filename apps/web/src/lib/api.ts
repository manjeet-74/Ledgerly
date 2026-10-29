const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const WORKSPACE_KEY = 'ledgerly.workspace';
const DEMO_ROLE_KEY = 'ledgerly.demoRole';
const TOKEN_KEY = 'ledgerly.token';

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * The ONLY fetch wrapper in the app -- every request goes through here so
 * the workspace/demo-role/auth headers are injected
 * exactly once, in exactly one place, instead of being repeated (and
 * eventually drifting) at every call site.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const workspace = safeRead(WORKSPACE_KEY) ?? 'DEMO';
  const demoRole = safeRead(DEMO_ROLE_KEY) ?? 'ADMIN';
  const token = safeRead(TOKEN_KEY);

  const headers = new Headers(init.headers);
  headers.set('X-Workspace', workspace);
  if (workspace === 'DEMO') {
    headers.set('X-Demo-Role', demoRole);
  } else if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401 && workspace === 'LIVE' && typeof window !== 'undefined') {
    window.location.href = '/login';
  }

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? body;
    } catch {
      // body wasn't JSON; use it as-is
    }
    throw new ApiError(response.status, message || response.statusText);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as Promise<T>;
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignored -- see mode.tsx for why
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignored
  }
}
