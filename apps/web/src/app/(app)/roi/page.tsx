import type { Metadata } from 'next';
import { RoiView } from './roi-view';

export const metadata: Metadata = {
  title: 'ROI Calculator',
  description: 'Model the payoff of catching wasted ad spend, using the same formula the engine runs on.',
};

export default function Page() {
  return <RoiView />;
}
