import type { ReactNode } from 'react';
import { requireInstructor } from '@/lib/role-guard';

// Server-side gate for every shelled instructor route. Runs before any child
// page renders, so a student that types /instructor/students into the URL
// gets redirected to /dashboard before the table query is even issued. The
// existing client-side useEffect redirects in pages stay as defense in depth.
export const dynamic = 'force-dynamic';

export default async function InstructorShellLayout({ children }: { children: ReactNode }) {
  await requireInstructor();
  return <>{children}</>;
}
