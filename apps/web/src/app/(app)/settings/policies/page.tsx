import type { Metadata } from 'next';
import { PoliciesView } from './policies-view';

export const metadata: Metadata = {
  title: 'Policies',
  description: 'Edit approval tiers and spend thresholds for new decisions.',
};

export default function Page() {
  return <PoliciesView />;
}
