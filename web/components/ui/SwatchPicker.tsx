import { cn } from './cn';

export interface SwatchOption {
  /** Stable identifier used in the value/onChange contract. */
  id: string;
  /** CSS colour painted onto the swatch tile. */
  color: string;
  /** Human-readable label (used as aria-label and tooltip). */
  label?: string;
}

export interface SwatchPickerProps {
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Row of selectable color tiles. The selected tile gets a peacock ring.
 * Clicking a tile fires `onChange(id)`.
 */
export function SwatchPicker({
  options,
  value,
  onChange,
  className,
  ariaLabel,
  disabled,
}: SwatchPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('swatch-picker', className)}
    >
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label ?? opt.id}
            title={opt.label ?? opt.id}
            disabled={disabled}
            className={cn('swatch', selected && 'selected')}
            style={{ background: opt.color }}
            onClick={() => onChange(opt.id)}
          />
        );
      })}
    </div>
  );
}
