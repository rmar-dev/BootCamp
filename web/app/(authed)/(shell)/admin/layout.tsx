import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/role-guard';

// Server-side gate for every shelled admin route. Runs before any child page
// renders, so an instructor or student that types /admin into the URL gets
// redirected to /dashboard before the page query is even issued.
export const dynamic = 'force-dynamic';

export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
