import { type ReactNode } from 'react';
import { cn } from './cn';

export interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Human-readable label rendered before the switch. */
  label?: ReactNode;
  disabled?: boolean;
  /** Override the on/off pill text. Default: "ON" / "OFF". */
  onLabel?: string;
  offLabel?: string;
  className?: string;
}

/**
 * Pill-style on/off switch. Shows ON in peacock when on, OFF in muted text
 * when off. Renders an optional left-side label so it can drop into a
 * label-on-left, control-on-right row.
 */
export function Toggle({
  on,
  onChange,
  label,
  disabled,
  onLabel = 'ON',
  offLabel = 'OFF',
  className,
}: ToggleProps) {
  return (
    <div className={cn('toggle-row', className)}>
      {label != null && <span className="toggle-label">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('toggle', on && 'on')}
        disabled={disabled}
        onClick={() => onChange(!on)}
      >
        {on ? onLabel : offLabel}
      </button>
    </div>
  );
}
