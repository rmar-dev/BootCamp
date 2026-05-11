import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from './cn';

export type ChoiceState = 'idle' | 'picked' | 'correct' | 'wrong';

export interface ChoiceProps extends Omit<ComponentPropsWithoutRef<'label'>, 'children'> {
  state?: ChoiceState;
  disabled?: boolean;
  /** Optional leading key glyph — typically a letter (A/B/C…) or number. */
  keyLabel?: ReactNode;
  /** Hidden form input (radio/checkbox) wired up by the caller. */
  input?: ReactNode;
  children: ReactNode;
}

export const Choice = forwardRef<HTMLLabelElement, ChoiceProps>(function Choice(
  { state = 'idle', disabled, keyLabel, input, className, children, ...rest },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn(
        'mc-option',
        state === 'picked' && 'picked',
        state === 'correct' && 'correct',
        state === 'wrong' && 'wrong',
        disabled && 'disabled',
        className,
      )}
      {...rest}
    >
      {input}
      {keyLabel != null && (
        <span className="mc-key" aria-hidden="true">{keyLabel}</span>
      )}
      <span className="mc-option-body">{children}</span>
    </label>
  );
});
