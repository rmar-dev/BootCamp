import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentPropsWithoutRef<'select'>, 'size'> {
  options?: SelectOption[];
  /** Visual size of the control. Renamed from `size` to avoid clashing with the
   * native HTMLSelectElement `size` attribute (which is a number). */
  controlSize?: 'sm' | 'md';
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, controlSize = 'md', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn('select', controlSize === 'sm' && 'select-sm', className)}
      {...rest}
    >
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
});
