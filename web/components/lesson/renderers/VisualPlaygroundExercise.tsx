'use client';
import { Fragment, useMemo, useState } from 'react';
import type {
  ExerciseDTO,
  ExerciseAttemptStatus,
  PlaygroundColorOption,
  PlaygroundControl,
  VisualPlaygroundPayload,
} from '@/lib/exercise-payloads';
import {
  Card, CodeFrame, Eyebrow, Input, LiveBadge, PhonePreview, Slider,
  Stack, SwatchPicker, Toggle,
} from '@/components/ui';
import { generateSwiftUiTokens, type CodeToken } from './visual-playground/code-generator';
import { renderPlaygroundPreview } from './visual-playground/preview';

type State = Record<string, string | number | boolean>;

function initialState(controls: PlaygroundControl[]): State {
  const out: State = {};
  for (const c of controls) out[c.id] = c.default;
  return out;
}

// onAttempt is in the prop type so this renderer matches the ExerciseBlock
// switch contract, but visual playgrounds never fire it — they're
// exploration-only and the lesson player advances on the Continue button.
export function VisualPlaygroundExercise({
  exercise,
}: {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
}) {
  const payload = exercise.payload as VisualPlaygroundPayload;
  const [state, setState] = useState<State>(() => initialState(payload.controls));

  const tokens = useMemo(
    () => generateSwiftUiTokens(payload, state),
    [payload, state],
  );

  function setValue(id: string, next: string | number | boolean) {
    setState((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <div className="playground-grid">
      <PhonePreview>{renderPlaygroundPreview(payload, state)}</PhonePreview>

      <Stack gap="default">
        <Card>
          <Eyebrow>Modifiers</Eyebrow>
          <div className="playground-modifiers" style={{ marginTop: 12 }}>
            {payload.controls.map((c) => (
              <ControlRow
                key={c.id}
                control={c}
                value={state[c.id]}
                onChange={(next) => setValue(c.id, next)}
              />
            ))}
          </div>
        </Card>

        <CodeFrame
          tabs={[{ label: codeFileName(payload), active: true }]}
          rightSlot={<LiveBadge />}
        >
          <pre className="mono" style={{ margin: 0, fontSize: 'var(--t-sm)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {tokens.map((t, i) =>
              t.cls ? <span key={i} className={t.cls}>{t.text}</span> : <Fragment key={i}>{t.text}</Fragment>,
            )}
          </pre>
        </CodeFrame>
      </Stack>
    </div>
  );
}

function codeFileName(payload: VisualPlaygroundPayload): string {
  const base = payload.primitive.charAt(0).toUpperCase() + payload.primitive.slice(1);
  return payload.language === 'kotlin' ? `${base}.kt` : `${base}.swift`;
}

function ControlRow({
  control,
  value,
  onChange,
}: {
  control: PlaygroundControl;
  value: string | number | boolean | undefined;
  onChange: (next: string | number | boolean) => void;
}) {
  switch (control.kind) {
    case 'text':
      return (
        <div className="playground-modifier">
          <span className="playground-modifier-label">{control.label}</span>
          <Input
            value={typeof value === 'string' ? value : ''}
            aria-label={control.label}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case 'color': {
      const sel = typeof value === 'string' ? value : control.default;
      const selectedLabel =
        control.options.find((o) => o.id === sel)?.label ?? sel;
      return (
        <div className="playground-modifier">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="playground-modifier-label">{control.label}</span>
            <span className="mono" style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)' }}>
              {selectedLabel}
            </span>
          </div>
          <SwatchPicker
            ariaLabel={control.label}
            value={sel}
            onChange={onChange}
            options={control.options.map((o: PlaygroundColorOption) => ({
              id: o.id,
              color: o.cssColor,
              label: o.label ?? o.id,
            }))}
          />
        </div>
      );
    }
    case 'slider': {
      const v = typeof value === 'number' ? value : control.default;
      const unit = control.unit ?? '';
      return (
        <div className="playground-modifier">
          <Slider
            label={control.label}
            valueLabel={`${v}${unit}`}
            value={v}
            min={control.min}
            max={control.max}
            step={control.step ?? 1}
            onChange={onChange}
          />
        </div>
      );
    }
    case 'toggle': {
      const v = typeof value === 'boolean' ? value : control.default;
      return (
        <div className="playground-modifier">
          <Toggle label={control.label} on={v} onChange={onChange} />
        </div>
      );
    }
  }
}

export type { CodeToken };
