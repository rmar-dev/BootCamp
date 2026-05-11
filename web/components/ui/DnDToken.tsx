import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface DnDTokenProps extends ComponentPropsWithoutRef<'button'> {
  used?: boolean;
}

export const DnDToken = forwardRef<HTMLButtonElement, DnDTokenProps>(function DnDToken(
  { used, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('dnd-token', used && 'used', className)}
      {...rest}
    />
  );
});
