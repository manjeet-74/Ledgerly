import Link from 'next/link';
import { Compass } from 'lucide-react';
import { site } from '@/content/site';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass size={40} className="text-text-dim" aria-hidden />
      <h1 className="font-display text-2xl font-semibold text-text">Page not found</h1>
      <p className="max-w-sm text-sm text-text-dim">
        That page doesn&apos;t exist in {site.name}. It may have moved, or the link was mistyped.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex min-h-[44px] items-center rounded-btn bg-brand px-6 font-medium text-white hover:bg-brand/90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
