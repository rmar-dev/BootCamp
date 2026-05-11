import { type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface KPIProps extends ComponentPropsWithoutRef<'div'> {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  peacock?: boolean;
  mono?: boolean;
}

export function KPI({ label, value, delta, peacock, mono = true, className, ...rest }: KPIProps) {
  return (
    <div className={cn('kpi', className)} {...rest}>
      <div className="kpi-label">{label}</div>
      <div className={cn('kpi-value', mono && 'mono', peacock && 'peacock-text')}>{value}</div>
      {delta !== undefined && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}
