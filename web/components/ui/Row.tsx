import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export interface RowProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  between?: boolean;
}

export function Row({ as: Tag = 'div', between, className, ...rest }: RowProps) {
  return <Tag className={cn(between ? 'row-between' : 'row', className)} {...rest} />;
}
