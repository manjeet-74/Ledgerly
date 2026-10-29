import type { Metadata } from 'next';
import { TrustView } from './trust-view';

export const metadata: Metadata = {
  title: 'Trust Center',
  description: 'Live controls measured against the system actually running right now.',
};

export default function Page() {
  return <TrustView />;
}
