import type { Metadata } from 'next';
import { LoginView } from './login-view';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Ledgerly LIVE to work with your own uploaded data.',
};

export default function Page() {
  return <LoginView />;
}
