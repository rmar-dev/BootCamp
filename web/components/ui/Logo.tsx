import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type LogoSize = 'sm' | 'md';

export interface LogoProps extends ComponentPropsWithoutRef<'span'> {
  size?: LogoSize;
  label?: string;
}

export const Logo = forwardRef<HTMLSpanElement, LogoProps>(function Logo(
  { size = 'md', label = 'BootCamp', className, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn('logo', size === 'sm' && 'logo-sm', className)} {...rest}>
      <span className="logo-mark" />
      <span>{label}</span>
    </span>
  );
});
