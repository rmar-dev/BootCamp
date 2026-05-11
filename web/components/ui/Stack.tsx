import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export type StackGap = 'tight' | 'default' | 'loose';

export interface StackProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  gap?: StackGap;
}

export function Stack({ as: Tag = 'div', gap = 'default', className, ...rest }: StackProps) {
  return (
    <Tag
      className={cn(
        'stack',
        gap === 'tight' && 'stack-tight',
        gap === 'loose' && 'stack-loose',
        className,
      )}
      {...rest}
    />
  );
}
