import type { Metadata } from 'next';
import { LandingView } from '@/components/landing/landing-view';
import { site } from '@/content/site';

export const metadata: Metadata = {
  description: site.tagline,
};

export default function Page() {
  return <LandingView />;
}
