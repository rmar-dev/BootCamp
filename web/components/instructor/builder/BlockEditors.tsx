'use client';
import type {
  CodePayload,
  ExercisePayload,
  FillBlankPayload,
  FixBugPayload,
  Language,
  LessonBlock,
  MultipleChoiceOption,
  MultipleChoicePayload,
  PredictOutputPayload,
  VideoBlockData,
} from '@/lib/exercise-payloads';
import { Button, Field, Icon, Input, Select, Textarea } from '@/components/ui';

interface EditorProps {
  block: LessonBlock;
  onChange: (block: LessonBlock) => void;
}

export function ExplanationEditor({ block, onChange }: EditorProps) {
  if (block.kind !== 'explanation') return null;
  return (
    <Field label="Markdown" htmlFor={`md-${block.id}`} help="Headings, bold, code spans — rendered as student-facing prose.">
      <Textarea
        id={`md-${block.id}`}
        mono
        value={block.markdown}
        onChange={(e) => onChange({ ...block, markdown: e.target.value })}
        placeholder="## Why this matters&#10;&#10;Local, mutable storage owned by a single view…"
        rows={8}
      />
    </Field>
  );
}

export function VideoEditor({ block, onChange }: EditorProps) {
  if (block.kind !== 'video') return null;
  const setVideo = (patch: Partial<VideoBlockData>) =>
    onChange({ ...block, video: { ...block.video, ...patch } });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field label="URL" htmlFor={`vurl-${block.id}`} style={{ gridColumn: '1 / -1' }} help="YouTube, Vimeo, Loom, or a direct .mp4">
        <Input
          id={`vurl-${block.id}`}
          value={block.video.url}
          onChange={(e) => setVideo({ url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </Field>
      <Field label="Title" htmlFor={`vtitle-${block.id}`}>
        <Input
          id={`vtitle-${block.id}`}
          value={block.video.title ?? ''}
          onChange={(e) => setVideo({ title: e.target.value })}
        />
      </Field>
      <Field label="Duration label" htmlFor={`vdur-${block.id}`} help={'e.g. "2:14"'}>
        <Input
          id={`vdur-${block.id}`}
          value={block.video.durationLabel ?? ''}
          onChange={(e) => setVideo({ durationLabel: e.target.value })}
        />
      </Field>
      <Field label="Description" htmlFor={`vdesc-${block.id}`} style={{ gridColumn: '1 / -1' }}>
        <Textarea
          id={`vdesc-${block.id}`}
          rows={2}
          value={block.video.description ?? ''}
          onChange={(e) => setVideo({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}

const LANGUAGE_OPTS = [
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
];

export function ExerciseEditor({ block, onChange }: EditorProps) {
  if (block.kind !== 'exercise') return null;
  const ex = block.exercise;

  const setPayload = (payload: ExercisePayload) =>
    onChange({ ...block, exercise: { ...ex, payload } });
  const setPrompt = (promptMarkdown: string) =>
    onChange({ ...block, exercise: { ...ex, promptMarkdown } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field
        label="Prompt"
        htmlFor={`ex-prompt-${ex.id}`}
        help="The question or instruction shown above the exercise."
      >
        <Textarea
          id={`ex-prompt-${ex.id}`}
          mono
          rows={3}
          value={ex.promptMarkdown}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Implement `greet(name:)` so it returns 'Hello, BootCamp!'"
        />
      </Field>

      {ex.payload.type === 'code' && <CodePayloadEditor payload={ex.payload} onChange={setPayload} />}
      {ex.payload.type === 'fix_bug' && <FixBugPayloadEditor payload={ex.payload} onChange={setPayload} />}
      {ex.payload.type === 'fill_blank' && <FillBlankPayloadEditor payload={ex.payload} onChange={setPayload} />}
      {ex.payload.type === 'predict_output' && <PredictOutputPayloadEditor payload={ex.payload} onChange={setPayload} />}
      {ex.payload.type === 'multiple_choice' && <MultipleChoicePayloadEditor payload={ex.payload} onChange={setPayload} />}
      {ex.payload.type === 'capstone_submission' && (
        <p className="muted" style={{ fontSize: 'var(--t-sm)', margin: 0 }}>
          Capstone submissions are instructor-graded. No payload to configure.
        </p>
      )}
      {ex.payload.type === 'visual_playground' && (
        <p className="muted" style={{ fontSize: 'var(--t-sm)', margin: 0 }}>
          Playground controls editor coming soon — preview-only for now. Defaults
          render a button with label + corner radius controls.
        </p>
      )}
    </div>
  );
}

// ── Per-payload editors ──────────────────────────────────────────────────────

function CodePayloadEditor({
  payload,
  onChange,
}: {
  payload: CodePayload;
  onChange: (p: ExercisePayload) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
      <Field label="Language" htmlFor={`lang-${payload.testEntryPoint}`} style={{ gridColumn: '2', gridRow: '1' }}>
        <Select
          value={payload.language}
          options={LANGUAGE_OPTS}
          onChange={(e) => onChange({ ...payload, language: e.target.value as Language })}
        />
      </Field>
      <Field label="Test entry point" style={{ gridColumn: '2', gridRow: '2' }}>
        <Input
          value={payload.testEntryPoint}
          onChange={(e) => onChange({ ...payload, testEntryPoint: e.target.value })}
        />
      </Field>
      <Field label="Starter code" style={{ gridColumn: '1', gridRow: '1 / span 2' }}>
        <Textarea
          mono
          rows={8}
          value={payload.starterCode}
          onChange={(e) => onChange({ ...payload, starterCode: e.target.value })}
        />
      </Field>
      <Field label="Test code" style={{ gridColumn: '1 / -1' }} help="Runs in the sandbox; failures surface in the student's output panel.">
        <Textarea
          mono
          rows={6}
          value={payload.testCode}
          onChange={(e) => onChange({ ...payload, testCode: e.target.value })}
        />
      </Field>
    </div>
  );
}

function FixBugPayloadEditor({
  payload,
  onChange,
}: {
  payload: FixBugPayload;
  onChange: (p: ExercisePayload) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
        <Field label="Broken code" style={{ gridColumn: '1', gridRow: '1 / span 2' }}>
          <Textarea
            mono
            rows={8}
            value={payload.brokenCode}
            onChange={(e) => onChange({ ...payload, brokenCode: e.target.value })}
          />
        </Field>
        <Field label="Language" style={{ gridColumn: '2' }}>
          <Select
            value={payload.language}
            options={LANGUAGE_OPTS}
            onChange={(e) => onChange({ ...payload, language: e.target.value as Language })}
          />
        </Field>
        <Field label="Test entry point" style={{ gridColumn: '2' }}>
          <Input
            value={payload.testEntryPoint}
            onChange={(e) => onChange({ ...payload, testEntryPoint: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Test code">
        <Textarea
          mono
          rows={6}
          value={payload.testCode}
          onChange={(e) => onChange({ ...payload, testCode: e.target.value })}
        />
      </Field>
    </div>
  );
}

function FillBlankPayloadEditor({
  payload,
  onChange,
}: {
  payload: FillBlankPayload;
  onChange: (p: ExercisePayload) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Language" style={{ maxWidth: 200 }}>
        <Select
          value={payload.language}
          options={LANGUAGE_OPTS}
          onChange={(e) => onChange({ ...payload, language: e.target.value as Language })}
        />
      </Field>
      <Field label="Template" help="Use `___1`, `___2`, … for blanks (matches frontmatter convention).">
        <Textarea
          mono
          rows={4}
          value={payload.template}
          onChange={(e) => onChange({ ...payload, template: e.target.value })}
        />
      </Field>
      <Field label="Blanks" help="One row per placeholder. Comma-separated accepted answers.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payload.blanks.map((b, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 32px', gap: 8 }}>
              <Input
                value={b.id}
                onChange={(e) => {
                  const next = [...payload.blanks];
                  next[idx] = { ...b, id: e.target.value };
                  onChange({ ...payload, blanks: next });
                }}
              />
              <Input
                value={b.expected.join(', ')}
                onChange={(e) => {
                  const next = [...payload.blanks];
                  next[idx] = {
                    ...b,
                    expected: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  };
                  onChange({ ...payload, blanks: next });
                }}
                placeholder="let, var"
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Remove blank ${b.id}`}
                onClick={() => onChange({ ...payload, blanks: payload.blanks.filter((_, i) => i !== idx) })}
              >
                <Icon name="trash" size={12} />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="plus" size={12} />}
            onClick={() =>
              onChange({
                ...payload,
                blanks: [...payload.blanks, { id: String(payload.blanks.length + 1), expected: [''] }],
              })
            }
          >
            Add blank
          </Button>
        </div>
      </Field>
    </div>
  );
}

function PredictOutputPayloadEditor({
  payload,
  onChange,
}: {
  payload: PredictOutputPayload;
  onChange: (p: ExercisePayload) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Language" style={{ maxWidth: 200 }}>
        <Select
          value={payload.displayedLanguage}
          options={LANGUAGE_OPTS}
          onChange={(e) =>
            onChange({ ...payload, displayedLanguage: e.target.value as Language })
          }
        />
      </Field>
      <Field label="Displayed code">
        <Textarea
          mono
          rows={6}
          value={payload.displayedCode}
          onChange={(e) => onChange({ ...payload, displayedCode: e.target.value })}
        />
      </Field>
      <Field label="Expected output" help="Exact match against student's typed answer.">
        <Textarea
          mono
          rows={3}
          value={payload.expectedOutput}
          onChange={(e) => onChange({ ...payload, expectedOutput: e.target.value })}
        />
      </Field>
    </div>
  );
}

function MultipleChoicePayloadEditor({
  payload,
  onChange,
}: {
  payload: MultipleChoicePayload;
  onChange: (p: ExercisePayload) => void;
}) {
  const setOptions = (options: MultipleChoiceOption[], correctOptionIds = payload.correctOptionIds) => {
    const validIds = new Set(options.map((o) => o.id));
    onChange({
      ...payload,
      options,
      correctOptionIds: correctOptionIds.filter((id) => validIds.has(id)),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Question (markdown)">
        <Textarea
          mono
          rows={3}
          value={payload.questionMarkdown}
          onChange={(e) => onChange({ ...payload, questionMarkdown: e.target.value })}
          placeholder="What does `@State` primarily provide?"
        />
      </Field>

      <Field label="Options" help="Tick the correct one(s). Toggle multi-select to allow more than one.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payload.options.map((opt, idx) => {
            const isCorrect = payload.correctOptionIds.includes(opt.id);
            return (
              <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: 'auto 60px 1fr 32px', gap: 8, alignItems: 'center' }}>
                <input
                  type={payload.multiSelect ? 'checkbox' : 'radio'}
                  name={`mc-${payload.questionMarkdown.length}`}
                  checked={isCorrect}
                  onChange={() => {
                    const nextCorrect = payload.multiSelect
                      ? isCorrect
                        ? payload.correctOptionIds.filter((id) => id !== opt.id)
                        : [...payload.correctOptionIds, opt.id]
                      : [opt.id];
                    onChange({ ...payload, correctOptionIds: nextCorrect });
                  }}
                  aria-label={`Mark option ${opt.id} correct`}
                />
                <Input
                  value={opt.id}
                  onChange={(e) => {
                    const next = [...payload.options];
                    next[idx] = { ...opt, id: e.target.value };
                    setOptions(next, payload.correctOptionIds);
                  }}
                />
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const next = [...payload.options];
                    next[idx] = { ...opt, text: e.target.value };
                    setOptions(next, payload.correctOptionIds);
                  }}
                  placeholder="Option text"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Remove option ${opt.id}`}
                  onClick={() =>
                    setOptions(
                      payload.options.filter((_, i) => i !== idx),
                      payload.correctOptionIds.filter((id) => id !== opt.id),
                    )
                  }
                >
                  <Icon name="trash" size={12} />
                </Button>
              </div>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="plus" size={12} />}
            onClick={() => {
              const nextId = String.fromCharCode(97 + payload.options.length);
              setOptions([...payload.options, { id: nextId, text: 'New option' }]);
            }}
          >
            Add option
          </Button>
        </div>
      </Field>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-sm)', color: 'var(--text-2)' }}>
        <input
          type="checkbox"
          checked={payload.multiSelect}
          onChange={(e) =>
            onChange({
              ...payload,
              multiSelect: e.target.checked,
              correctOptionIds: e.target.checked
                ? payload.correctOptionIds
                : payload.correctOptionIds.slice(0, 1),
            })
          }
        />
        Allow multiple correct answers
      </label>
    </div>
  );
}
