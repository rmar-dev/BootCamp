'use client';
import { useState, Fragment } from 'react';
import type { FillBlankPayload } from '@/lib/exercise-payloads';
import { PrimaryButton } from '@/components/lesson/renderers/_shared';

const TOKEN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

type Segment = { kind: 'text'; text: string } | { kind: 'blank'; id: string };

function tokenize(template: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(template)) !== null) {
    const [whole, id] = match;
    const start = match.index;
    if (start > lastIndex) segments.push({ kind: 'text', text: template.slice(lastIndex, start) });
    segments.push({ kind: 'blank', id });
    lastIndex = start + whole.length;
  }
  if (lastIndex < template.length) segments.push({ kind: 'text', text: template.slice(lastIndex) });
  return segments;
}

type Props = {
  payload: FillBlankPayload;
  onSubmit: (answer: Record<string, string>) => void | Promise<void>;
  disabled?: boolean;
};

export function ReviewFillBlank({ payload, onSubmit, disabled }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const segments = tokenize(payload.template);

  return (
    <div className="space-y-4">
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-sm leading-6 text-gray-100">
        {segments.map((s, i) =>
          s.kind === 'text' ? (
            <Fragment key={i}>{s.text}</Fragment>
          ) : (
            <input
              key={i}
              aria-label={`blank-${s.id}`}
              className="mx-1 inline-block w-28 rounded border border-gray-500 bg-gray-800 px-2 py-0.5 font-mono text-gray-100 focus:border-blue-400 focus:outline-none"
              value={values[s.id] ?? ''}
              onChange={(e) => setValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              disabled={disabled}
            />
          ),
        )}
      </pre>
      <PrimaryButton onClick={() => onSubmit(values)} disabled={disabled}>
        Submit
      </PrimaryButton>
    </div>
  );
}
