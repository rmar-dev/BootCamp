'use client';
import { useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface TweaksPanelProps {
  title?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function TweaksPanel({ title = 'Tweaks', defaultOpen = false, children, className }: TweaksPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(className)}
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 50,
        background: 'var(--bg-2)', border: '1px solid var(--line-2)',
        borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-2)',
        minWidth: open ? 240 : 'auto', padding: open ? 12 : 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-sm"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span>{title}</span>
        <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export interface TweakSectionProps { label: string; }
export function TweakSection({ label }: TweakSectionProps) {
  return (
    <div className="eyebrow" style={{ margin: '12px 0 6px' }}>{label}</div>
  );
}

export interface TweakRadioProps<T extends string> {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}
export function TweakRadio<T extends string>({ label, value, options, onChange }: TweakRadioProps<T>) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div className="row" style={{ gap: 6 }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn('chip', o === value && 'active')}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
