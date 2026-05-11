import { type ReactNode } from 'react';
import { cn } from './cn';

export type ToastTone = 'neutral' | 'brand' | 'success';

export interface ToastProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: ToastTone;
  visible?: boolean;
  className?: string;
}

/** Single toast surface. Pair with `ToastStack` to render a column of these. */
export function Toast({ title, description, icon, tone = 'neutral', visible = true, className }: ToastProps) {
  return (
    <div
      className={cn(
        'toast',
        `toast-${tone}`,
        visible ? 'toast-in' : 'toast-out',
        className,
      )}
      role="status"
    >
      {icon && <span className="toast-icon" aria-hidden="true">{icon}</span>}
      <div className="toast-body">
        <div className="toast-title">{title}</div>
        {description && <div className="toast-desc">{description}</div>}
      </div>
    </div>
  );
}

export interface ToastStackProps {
  children: ReactNode;
  position?: 'top-right' | 'bottom-right';
  className?: string;
}

export function ToastStack({ children, position = 'top-right', className }: ToastStackProps) {
  return (
    <div
      className={cn('toast-stack', `toast-stack-${position}`, className)}
      aria-live="polite"
    >
      {children}
    </div>
  );
}
