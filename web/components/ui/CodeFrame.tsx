import { type ReactNode } from 'react';
import { cn } from './cn';

export interface CodeFrameTab {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface CodeFrameProps {
  tabs?: CodeFrameTab[];
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CodeFrame({ tabs, rightSlot, children, className }: CodeFrameProps) {
  return (
    <div className={cn('code-frame', className)}>
      {(tabs?.length || rightSlot) && (
        <div className="code-frame-head">
          <div className="code-frame-tabs">
            {tabs?.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={t.onClick}
                className={cn('code-tab', t.active && 'active')}
              >
                {t.label}
              </button>
            ))}
          </div>
          {rightSlot}
        </div>
      )}
      <div className="code-frame-body">{children}</div>
    </div>
  );
}
