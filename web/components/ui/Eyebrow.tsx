import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export interface EyebrowProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
}

export function Eyebrow({ as: Tag = 'div', className, ...rest }: EyebrowProps) {
  return <Tag className={cn('eyebrow', className)} {...rest} />;
}
