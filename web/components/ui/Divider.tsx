import { type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export function Divider({ className, ...rest }: ComponentPropsWithoutRef<'hr'>) {
  return <hr className={cn('divider', className)} {...rest} />;
}
