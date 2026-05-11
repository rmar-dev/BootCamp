import { forwardRef, type ChangeEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  /** Human-readable label rendered above the slider. */
  label?: ReactNode;
  /** Right-aligned readout, e.g. "21pt" or "amber". */
  valueLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Range slider with a label/value-readout row above the track. The track is
 * styled with the peacock gradient so the filled portion is brand-coloured.
 * Falls back to the native input semantics for accessibility.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { value, min, max, step = 1, onChange, label, valueLabel, disabled, className, ariaLabel },
  ref,
) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('slider', className)}>
      {(label != null || valueLabel != null) && (
        <div className="slider-head">
          {label != null && <span className="slider-label">{label}</span>}
          {valueLabel != null && <span className="slider-value mono">{valueLabel}</span>}
        </div>
      )}
      <input
        ref={ref}
        type="range"
        className="slider-input"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        style={{ ['--slider-pct' as string]: `${pct}%` }}
      />
    </div>
  );
});
