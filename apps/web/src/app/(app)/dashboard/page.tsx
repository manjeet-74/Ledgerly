import type { Metadata } from 'next';
import { DashboardView } from './dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Live state of the decision engine, the approval queue, and the audit trail.',
};

export default function Page() {
  return <DashboardView />;
}
