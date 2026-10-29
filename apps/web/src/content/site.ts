/**
 * Single source of truth for anything that would otherwise be hardcoded in
 * three different components (nav links, contact details, the footer's
 * copyright year). Keeping the email and phone here makes them clickable
 * (mailto:/tel:) in one place and keeps the year from ever going stale,
 * instead of being retyped into JSX.
 */
export const site = {
  name: 'Ledgerly',
  tagline: 'The decision trust layer for marketing spend.',
  contactEmail: 'hello@ledgerly.dev',
  contactPhone: '+1 555 010 1234',
  disclaimer: 'Independent concept project. Not affiliated with any other company.',
  nav: [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decisions', href: '/decisions' },
    { label: 'Audit Trail', href: '/audit' },
    { label: 'Trust Center', href: '/trust' },
    { label: 'ROI Calculator', href: '/roi' },
    { label: 'Data', href: '/data' },
  ],
  get year(): number {
    return new Date().getFullYear();
  },
};

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
