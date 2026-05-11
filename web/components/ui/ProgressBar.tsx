import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type BarThickness = 'thin' | 'default' | 'thick';

export interface ProgressBarProps extends ComponentPropsWithoutRef<'div'> {
  value: number;
  thickness?: BarThickness;
  fillStyle?: React.CSSProperties;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, thickness = 'default', fillStyle, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bar',
        thickness === 'thin' && 'bar-thin',
        thickness === 'thick' && 'bar-thick',
        className,
      )}
      {...rest}
    >
      <div className="bar-fill" style={{ width: `${clamp(value)}%`, ...fillStyle }} />
    </div>
  );
});
