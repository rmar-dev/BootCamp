import type { CSSProperties, ReactNode } from 'react';
import { cn } from './cn';

export interface FieldProps {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Field({ label, help, error, htmlFor, className, style, children }: FieldProps) {
  return (
    <div className={cn('field', className)} style={style}>
      {label !== undefined && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : help ? (
        <span className="field-help">{help}</span>
      ) : null}
    </div>
  );
}
