const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Downloads a file from the API as a browser Blob -- separate from `apiFetch` because a file download is a side effect (triggering a Save dialog), not a typed JSON response. */
export async function downloadFromApi(path: string, filename: string): Promise<void> {
  const workspace = safeRead('ledgerly.workspace') ?? 'DEMO';
  const demoRole = safeRead('ledgerly.demoRole') ?? 'ADMIN';
  const token = safeRead('ledgerly.token');

  const headers = new Headers();
  headers.set('X-Workspace', workspace);
  if (workspace === 'DEMO') {
    headers.set('X-Demo-Role', demoRole);
  } else if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) throw new Error(`Export failed (${response.status}).`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
