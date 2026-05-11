import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type CardVariant = 'default' | 'elevated' | 'glow';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'card',
        variant === 'elevated' && 'card-elevated',
        variant === 'glow' && 'card-glow',
        className,
      )}
      {...rest}
    />
  );
});
