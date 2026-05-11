import type { ReactNode } from 'react';
import { requireInstructor } from '@/lib/role-guard';

export const dynamic = 'force-dynamic';

export default async function ReviewShellLayout({ children }: { children: ReactNode }) {
  await requireInstructor();
  return <>{children}</>;
}
