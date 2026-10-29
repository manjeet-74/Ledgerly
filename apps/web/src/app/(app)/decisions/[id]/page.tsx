import type { Metadata } from 'next';
import { DecisionDetailView } from './decision-detail-view';

export const metadata: Metadata = {
  title: 'Decision detail',
  description: 'Evidence, approval status, audit trail, and outcome for a single decision.',
};

export default function Page() {
  return <DecisionDetailView />;
}
