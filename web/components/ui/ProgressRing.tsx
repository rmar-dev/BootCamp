import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { cn } from './cn';

export interface ProgressRingProps extends ComponentPropsWithoutRef<'div'> {
  value: number;
  size?: number;
  thick?: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const ProgressRing = forwardRef<HTMLDivElement, ProgressRingProps>(function ProgressRing(
  { value, size = 56, thick = 6, className, style, children, ...rest },
  ref,
) {
  const ringStyle: CSSProperties = {
    ...style,
    ['--p' as string]: clamp(value).toString(),
    ['--size' as string]: `${size}px`,
    ['--thick' as string]: `${thick}px`,
  };
  return (
    <div ref={ref} className={cn('ring', className)} style={ringStyle} {...rest}>
      {children}
    </div>
  );
});
