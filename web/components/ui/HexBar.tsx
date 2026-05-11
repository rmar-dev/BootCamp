import { cn } from './cn';

export type HexState = 'unattempted' | 'eventual' | 'first_try';

export interface HexBarProps {
  states: ReadonlyArray<HexState>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

export function HexBar({ states, size = 'md', className, ariaLabel }: HexBarProps) {
  const earned = states.filter((s) => s === 'first_try').length;
  const label = ariaLabel ?? `Hex score: ${earned} of ${states.length}`;
  return (
    <div
      className={cn('hexbar', size === 'sm' && 'hexbar-sm', size === 'lg' && 'hexbar-lg', className)}
      aria-label={label}
      role="img"
    >
      {states.map((s, i) => (
        <span key={i} className={`hex ${s}`} aria-hidden="true" />
      ))}
    </div>
  );
}
