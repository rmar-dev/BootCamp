import type { ReactNode } from 'react';
import { cn } from './cn';

export interface TabOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps<T extends string = string> {
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
  stretch?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Tabs<T extends string = string>({
  value,
  options,
  onChange,
  stretch,
  className,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('tabs', stretch && 'tabs-stretch', className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cn('tab', value === opt.value && 'active')}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
