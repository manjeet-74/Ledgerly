import type { Metadata } from 'next';
import { AuditView } from './audit-view';

export const metadata: Metadata = {
  title: 'Audit Trail',
  description: 'A tamper-evident, hash-chained record of every decision, approval, and execution.',
};

export default function Page() {
  return <AuditView />;
}
