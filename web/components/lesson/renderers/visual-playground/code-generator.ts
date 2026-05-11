import type {
  PlaygroundControl,
  VisualPlaygroundPayload,
} from '@/lib/exercise-payloads';

export type CodeToken = { text: string; cls?: string };

type State = Record<string, string | number | boolean>;

/**
 * Build syntax-highlighted SwiftUI / Kotlin tokens from the current playground
 * state. Pure: same payload + state ⇒ identical token stream, suitable for
 * snapshot tests.
 *
 * Currently only Swift + the `button` primitive are wired. The control id
 * convention for the button:
 *   - `label` (text)            → `Button("LABEL") { }`
 *   - `backgroundColor` (color) → `.background(Color.NAME)`
 *   - `cornerRadius` (slider)   → `.cornerRadius(N)`
 *   - `shadow` (toggle)         → `.shadow(radius: 8)` when true
 */
export function generateSwiftUiTokens(
  payload: VisualPlaygroundPayload,
  state: State,
): CodeToken[] {
  switch (payload.primitive) {
    case 'button':
      return generateButtonTokens(payload, state);
  }
}

function generateButtonTokens(
  payload: VisualPlaygroundPayload,
  state: State,
): CodeToken[] {
  const out: CodeToken[] = [];

  const label = readString(payload.controls, state, 'label');
  out.push({ text: 'Button', cls: 'tok-t' });
  out.push({ text: '(' });
  out.push({ text: `"${label}"`, cls: 'tok-s' });
  out.push({ text: ') { }' });

  out.push({ text: '\n  ' });
  out.push({ text: '.padding', cls: 'tok-f' });
  out.push({ text: '(' });
  out.push({ text: '.horizontal', cls: 'tok-a' });
  out.push({ text: ', ' });
  out.push({ text: '28', cls: 'tok-n' });
  out.push({ text: ')' });

  const colorRef = readColorCodeRef(payload.controls, state, 'backgroundColor');
  if (colorRef) {
    out.push({ text: '\n  ' });
    out.push({ text: '.background', cls: 'tok-f' });
    out.push({ text: '(' });
    out.push({ text: 'Color', cls: 'tok-t' });
    out.push({ text: `.${colorRef}`, cls: 'tok-a' });
    out.push({ text: ')' });
  }

  const radius = readNumber(payload.controls, state, 'cornerRadius');
  if (radius != null) {
    out.push({ text: '\n  ' });
    out.push({ text: '.cornerRadius', cls: 'tok-f' });
    out.push({ text: '(' });
    out.push({ text: String(radius), cls: 'tok-n' });
    out.push({ text: ')' });
  }

  const shadow = readBoolean(payload.controls, state, 'shadow');
  if (shadow) {
    out.push({ text: '\n  ' });
    out.push({ text: '.shadow', cls: 'tok-f' });
    out.push({ text: '(' });
    out.push({ text: 'radius', cls: 'tok-a' });
    out.push({ text: ': ' });
    out.push({ text: '8', cls: 'tok-n' });
    out.push({ text: ')' });
  }

  return out;
}

/** Flatten the token stream into the equivalent plain-text source. */
export function tokensToString(tokens: CodeToken[]): string {
  return tokens.map((t) => t.text).join('');
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

function readColorCodeRef(
  controls: PlaygroundControl[],
  state: State,
  id: string,
): string | null {
  const c = controls.find((c) => c.id === id);
  if (c?.kind !== 'color') return null;
  const selectedId = typeof state[id] === 'string' ? (state[id] as string) : c.default;
  const opt = c.options.find((o) => o.id === selectedId);
  return opt?.codeRef ?? null;
}
