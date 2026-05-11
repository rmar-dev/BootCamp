import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type DnDTint = 'swift' | 'kotlin' | undefined;

export interface DnDSlotProps extends ComponentPropsWithoutRef<'span'> {
  filled?: boolean;
  tint?: DnDTint;
}

export const DnDSlot = forwardRef<HTMLSpanElement, DnDSlotProps>(function DnDSlot(
  { filled, tint, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn('dnd-slot', filled && 'filled', tint, className)}
      {...rest}
    />
  );
});
