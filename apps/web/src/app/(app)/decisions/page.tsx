import type { Metadata } from 'next';
import { DecisionsView } from './decisions-view';

export const metadata: Metadata = {
  title: 'Decisions',
  description: 'Every recommendation the decision engine has made, filterable by status and type.',
};

export default function Page() {
  return <DecisionsView />;
}
