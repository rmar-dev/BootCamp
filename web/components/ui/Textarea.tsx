import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, mono, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      spellCheck={mono ? false : undefined}
      className={cn('textarea', mono && 'textarea-mono', className)}
      {...rest}
    />
  );
});
