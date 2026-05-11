'use client';
import type { LessonBlock } from '@/lib/exercise-payloads';
import type { LessonDraft, ValidationIssue } from '@/lib/builder';
import { Badge, Button, Field, Icon, Input, Textarea } from '@/components/ui';
import { blockMeta } from './blockMeta';

interface Props {
  draft: LessonDraft;
  block: LessonBlock | null;
  issues: ValidationIssue[];
  onBlockChange: (block: LessonBlock) => void;
}

export function BuilderInspector({ draft, block, issues, onBlockChange }: Props) {
  if (!block) {
    return (
      <div className="inspector-section">
        <p className="muted" style={{ fontSize: 'var(--t-sm)', margin: 0 }}>
          Select a block on the canvas to edit hints, points, and concepts.
        </p>
        <DraftSummary draft={draft} issueCount={issues.length} />
      </div>
    );
  }

  const meta = blockMeta(block);
  const isExercise = block.kind === 'exercise';
  const blockIssues = issues.filter((i) => i.blockId === block.id);

  return (
    <div>
      <div className="inspector-section">
        <span className="inspector-section-title">Block</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <Badge tone={meta.tone}><Icon name={meta.icon} size={11} />{meta.label}</Badge>
          <span className="mono muted" style={{ fontSize: 'var(--t-xs)' }}>{block.id.slice(-6)}</span>
        </div>
      </div>

      {isExercise && (
        <>
          <ExerciseInspector block={block} onChange={onBlockChange} />
        </>
      )}

      {blockIssues.length > 0 && (
        <div className="inspector-section">
          <span className="inspector-section-title" style={{ color: 'var(--danger-400)' }}>
            Issues
          </span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {blockIssues.map((iss, i) => (
              <li key={i} style={{ fontSize: 'var(--t-xs)', color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--danger-400)' }}>● </span>
                <span className="mono">{iss.field}</span> — {iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DraftSummary draft={draft} issueCount={issues.length} />
    </div>
  );
}

function ExerciseInspector({
  block,
  onChange,
}: {
  block: Extract<LessonBlock, { kind: 'exercise' }>;
  onChange: (block: LessonBlock) => void;
}) {
  const ex = block.exercise;
  const setEx = (patch: Partial<typeof ex>) =>
    onChange({ ...block, exercise: { ...ex, ...patch } });
  const hints = ex.hints ?? [];

  return (
    <>
      <div className="inspector-section">
        <span className="inspector-section-title">Scoring</span>
        <Field label="Points">
          <Input
            type="number"
            min={0}
            max={1000}
            step={10}
            value={ex.pointsMax}
            onChange={(e) => setEx({ pointsMax: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <div className="inspector-section">
        <span className="inspector-section-title">Hints</span>
        <p className="field-help" style={{ margin: 0 }}>
          Revealed one at a time behind a &ldquo;Hint&rdquo; affordance.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hints.map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 6, alignItems: 'start' }}>
              <Textarea
                rows={2}
                value={h}
                onChange={(e) => {
                  const next = [...hints];
                  next[i] = e.target.value;
                  setEx({ hints: next });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Remove hint ${i + 1}`}
                onClick={() => setEx({ hints: hints.filter((_, idx) => idx !== i) })}
              >
                <Icon name="trash" size={12} />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="plus" size={12} />}
            onClick={() => setEx({ hints: [...hints, ''] })}
          >
            Add hint
          </Button>
        </div>
      </div>
    </>
  );
}

function DraftSummary({ draft, issueCount }: { draft: LessonDraft; issueCount: number }) {
  return (
    <div className="inspector-section">
      <span className="inspector-section-title">Lesson</span>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{draft.blocks.length} block{draft.blocks.length === 1 ? '' : 's'}</span>
        <span>Last edit · {new Date(draft.updatedAt).toLocaleString()}</span>
        <span>{draft.publishedAt ? `Published · ${new Date(draft.publishedAt).toLocaleString()}` : 'Draft'}</span>
        <span style={{ color: issueCount > 0 ? 'var(--danger-400)' : 'var(--success-400)' }}>
          {issueCount > 0 ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'No issues'}
        </span>
      </div>
    </div>
  );
}
