import { cn } from './cn';

export interface StepDotsProps {
  total: number;
  current: number;
  className?: string;
  ariaLabel?: string;
}

export function StepDots({ total, current, className, ariaLabel }: StepDotsProps) {
  return (
    <div
      className={cn('step-dots', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(current + 1, total)}
      aria-label={ariaLabel ?? `Step ${Math.min(current + 1, total)} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        return <span key={i} className={`step-dot ${state}`} aria-hidden="true" />;
      })}
    </div>
  );
}
