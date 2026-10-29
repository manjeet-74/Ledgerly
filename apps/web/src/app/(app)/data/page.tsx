import type { Metadata } from 'next';
import { DataView } from './data-view';

export const metadata: Metadata = {
  title: 'Data',
  description: 'Upload marketing performance data, download a sample CSV, or send it over the ingest webhook.',
};

export default function Page() {
  return <DataView />;
}
