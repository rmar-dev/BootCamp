import { type ReactNode } from 'react';
import { Heading } from '@/components/ui/Heading';

export interface AppShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <>
      {(title || subtitle) && (
        <header style={{ marginBottom: 24 }}>
          {title && <Heading level="display">{title}</Heading>}
          {subtitle && (
            <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </>
  );
}
