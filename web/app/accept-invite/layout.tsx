import type { Metadata } from 'next';

// The accept-invite URL carries the magic-link token in its query string.
// no-referrer ensures the token is never sent in a Referer header to any
// third-party resource loaded by this page.
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

export default function AcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
