import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';
import { Heart } from './Heart';

export interface HeartsProps extends ComponentPropsWithoutRef<'div'> {
  count: number;
  total?: number;
  size?: number;
}

export function Hearts({ count, total = 5, size = 16, className, 'aria-label': aria = 'Hearts', ...rest }: HeartsProps) {
  return (
    <div className={cn('hearts', className)} aria-label={aria} {...rest}>
      {Array.from({ length: total }).map((_, i) => (
        <Heart key={i} size={size} empty={i >= count} />
      ))}
    </div>
  );
}
