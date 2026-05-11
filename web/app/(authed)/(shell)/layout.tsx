import type { ReactNode } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <div>
        <Topbar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
