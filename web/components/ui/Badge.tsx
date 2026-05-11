import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type BadgeTone = 'default' | 'brand' | 'iris' | 'amber' | 'success';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone;
  mono?: boolean;
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'default', mono, dot, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'badge',
        tone !== 'default' && `badge-${tone}`,
        mono && 'badge-mono',
        className,
      )}
      {...rest}
    >
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
});
