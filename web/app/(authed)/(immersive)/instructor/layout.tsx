import type { ReactNode } from 'react';
import { requireInstructor } from '@/lib/role-guard';

// Mirror of the shell layout's role gate — covers the immersive instructor
// surfaces (e.g. /instructor/builder/[id]) which use the no-chrome layout.
export const dynamic = 'force-dynamic';

export default async function InstructorImmersiveLayout({ children }: { children: ReactNode }) {
  await requireInstructor();
  return <>{children}</>;
}
