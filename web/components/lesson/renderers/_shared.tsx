import type { ReactNode } from 'react';
import { Button, Callout, Icon } from '@/components/ui';

/**
 * Back-compat shim used by the review surface (`components/review/*`).
 * New /lesson callers should use `<Button variant="primary">` directly.
 */
export function PrimaryButton({
  children,
  disabled,
  onClick,
  title,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <Button variant="primary" type={type} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function CheckResult({ result }: { result: null | { passed: boolean } }) {
  if (!result) return null;
  return (
    <Callout
      tone={result.passed ? 'success' : 'danger'}
      icon={<Icon name={result.passed ? 'check' : 'bolt'} size={14} />}
      size="sm"
    >
      <strong>{result.passed ? 'Correct!' : 'Not quite — try again.'}</strong>
    </Callout>
  );
}

export function LockedNotice({ onReset }: { onReset: () => void }) {
  return (
    <Callout
      tone="success"
      icon={<Icon name="check" size={14} />}
      title="Passed — submission locked"
      trailing={
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      }
    >
      Reset to try again.
    </Callout>
  );
}
