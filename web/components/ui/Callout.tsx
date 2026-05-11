import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export type CalloutTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';
export type CalloutSize = 'sm' | 'md';

export interface CalloutProps extends Omit<ComponentPropsWithoutRef<'div'>, 'title'> {
  tone?: CalloutTone;
  size?: CalloutSize;
  title?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Callout = forwardRef<HTMLDivElement, CalloutProps>(function Callout(
  { tone = 'neutral', size = 'md', title, icon, trailing, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      className={cn('callout', `callout-${tone}`, size === 'sm' && 'callout-sm', className)}
      {...rest}
    >
      {icon && <span className="callout-icon" aria-hidden="true">{icon}</span>}
      <div className="callout-body">
        {title && <div className="callout-title">{title}</div>}
        {children && <div className="callout-content">{children}</div>}
      </div>
      {trailing && <div className="callout-trailing">{trailing}</div>}
    </div>
  );
});
