import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type SkillNodeState = 'completed' | 'current' | 'available' | 'locked';
export type SkillNodeTint = 'swift' | 'kotlin' | 'shared';

export interface SkillNodeProps extends ComponentPropsWithoutRef<'button'> {
  state: SkillNodeState;
  tint?: SkillNodeTint;
}

export const SkillNode = forwardRef<HTMLButtonElement, SkillNodeProps>(function SkillNode(
  { state, tint = 'shared', className, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || state === 'locked'}
      className={cn('node', state, `tint-${tint}`, className)}
      {...rest}
    />
  );
});
