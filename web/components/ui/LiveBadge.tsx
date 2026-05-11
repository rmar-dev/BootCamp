import { cn } from './cn';

export interface LiveBadgeProps {
  className?: string;
  label?: string;
}

/**
 * Pill with a pulsing green dot + "LIVE" label. Used to flag the live-code
 * strip in the Visual Playground exercise so students know the snippet
 * updates in real time as they tweak the controls.
 */
export function LiveBadge({ className, label = 'LIVE' }: LiveBadgeProps) {
  return (
    <span className={cn('live-badge', className)}>
      <span className="live-dot" aria-hidden="true" />
      <span className="live-label">{label}</span>
    </span>
  );
}
