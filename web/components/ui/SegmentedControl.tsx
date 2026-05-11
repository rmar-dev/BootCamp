import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  activeClassName?: string;
}

export interface SegmentedControlProps<T extends string>
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
}

export function SegmentedControl<T extends string>({
  value, onChange, options, className, ...rest
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('seg', className)} {...rest}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn('seg-btn', active && 'active', active && opt.activeClassName)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
