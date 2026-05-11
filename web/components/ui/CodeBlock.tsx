import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export const CodeBlock = forwardRef<HTMLPreElement, ComponentPropsWithoutRef<'pre'>>(
  function CodeBlock({ className, ...rest }, ref) {
    return <pre ref={ref} className={cn('code-block', className)} {...rest} />;
  },
);
