import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface ChipProps extends ComponentPropsWithoutRef<'button'> {
  active?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('chip', active && 'active', className)}
      {...rest}
    />
  );
});
