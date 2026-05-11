import { type ReactNode } from 'react';
import { cn } from './cn';

export type CodeOutputStream = 'stdout' | 'stderr';

export interface CodeOutputProps {
  /** Raw text to render in the terminal block. */
  children: ReactNode;
  stream?: CodeOutputStream;
  label?: ReactNode;
  className?: string;
}

export function CodeOutput({ children, stream = 'stdout', label, className }: CodeOutputProps) {
  return (
    <div className={cn('code-output', `code-output-${stream}`, className)}>
      {label && <div className="code-output-label">{label}</div>}
      <pre className="code-output-body">{children}</pre>
    </div>
  );
}
