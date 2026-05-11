import type { ReactNode } from 'react';
import type {
  PlaygroundControl,
  VisualPlaygroundPayload,
} from '@/lib/exercise-payloads';

type State = Record<string, string | number | boolean>;

/**
 * Render the live HTML/CSS preview of the playground primitive. Mirrors the
 * SwiftUI modifiers chosen by the controls so the student sees their tweaks
 * reflected immediately.
 */
export function renderPlaygroundPreview(
  payload: VisualPlaygroundPayload,
  state: State,
): ReactNode {
  switch (payload.primitive) {
    case 'button':
      return renderButtonPreview(payload, state);
  }
}

function renderButtonPreview(
  payload: VisualPlaygroundPayload,
  state: State,
): ReactNode {
  const label = readString(payload.controls, state, 'label') || 'Button';
  const cssColor = readColorCss(payload.controls, state, 'backgroundColor') ?? 'var(--peacock-400)';
  const radius = readNumber(payload.controls, state, 'cornerRadius') ?? 8;
  const shadow = readBoolean(payload.controls, state, 'shadow');

  return (
    <button
      type="button"
      className="pg-button"
      style={{
        background: cssColor,
        borderRadius: radius,
        boxShadow: shadow
          ? `0 12px 32px -8px ${cssColor}`
          : 'none',
      }}
    >
      {label}
    </button>
  );
}

function readString(controls: PlaygroundControl[], state: State, id: string): string {
  const v = state[id];
  if (typeof v === 'string') return v;
  const c = controls.find((c) => c.id === id);
  return c?.kind === 'text' ? c.default : '';
}

function readNumber(controls: PlaygroundControl[], state: State, id: string): number | null {
  const v = state[id];
  if (typeof v === 'number') return v;
  const c = controls.find((c) => c.id === id);
  return c?.kind === 'slider' ? c.default : null;
}

function readBoolean(controls: PlaygroundControl[], state: State, id: string): boolean {
  const v = state[id];
  if (typeof v === 'boolean') return v;
  const c = controls.find((c) => c.id === id);
  return c?.kind === 'toggle' ? c.default : false;
}

function readColorCss(
  controls: PlaygroundControl[],
  state: State,
  id: string,
): string | null {
  const c = controls.find((c) => c.id === id);
  if (c?.kind !== 'color') return null;
  const selectedId = typeof state[id] === 'string' ? (state[id] as string) : c.default;
  const opt = c.options.find((o) => o.id === selectedId);
  return opt?.cssColor ?? null;
}
