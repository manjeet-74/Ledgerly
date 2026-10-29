'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Link from 'next/link';
import { apiFetch, ApiError, setAuthToken } from '@/lib/api';
import { useMode } from '@/lib/mode';
import { pageFadeRise } from '@/lib/motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { site } from '@/content/site';

interface LoginResult {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

export function LoginView() {
  const router = useRouter();
  const { setWorkspace } = useMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // The login request itself must go out before `workspace` becomes
      // LIVE in storage -- apiFetch reads workspace synchronously from
      // localStorage, and /auth/login doesn't need a workspace header
      // to resolve at all, so we just call it directly.
      const result = await apiFetch<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(result.token);
      setWorkspace('LIVE');
      toast.success(`Welcome back, ${result.user.name}.`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.div initial="hidden" animate="visible" variants={pageFadeRise} className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-display text-lg font-semibold text-text">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-2" aria-hidden />
          {site.name}
        </Link>
        <Card>
          <h1 className="font-display text-lg font-semibold text-text">Sign in to LIVE</h1>
          <p className="mt-1 text-sm text-text-dim">Use your real account to work with your own uploaded data.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-text-dim">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-text-dim">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-btn border border-card-border bg-bg-elev px-3 py-2 text-sm text-text"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-text-dim">
            Just exploring?{' '}
            <Link href="/dashboard" className="text-brand-2 hover:underline" onClick={() => setWorkspace('DEMO')}>
              Open the demo instead
            </Link>
          </p>
        </Card>
      </motion.div>
    </main>
  );
}
