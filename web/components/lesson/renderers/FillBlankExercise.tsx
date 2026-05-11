'use client';
import { Fragment, useMemo, useState } from 'react';
import type { ExerciseDTO, FillBlankPayload, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import { Badge, Button, Callout, CodeFrame, DnDSlot, DnDToken, Eyebrow, Stack, type DnDTint } from '@/components/ui';
import { CheckResult, LockedNotice } from './_shared';
import { PointsBadge } from './PointsBadge';
import { BadgeUnlock } from './BadgeUnlock';
import { useAuth } from '@/components/layout/AuthProvider';

const TOKEN = /___([a-zA-Z0-9_-]+)___|\{\{([a-zA-Z0-9_-]+)\}\}/g;

type Segment = { kind: 'text'; text: string } | { kind: 'blank'; id: string };

function tokenize(template: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN.exec(template)) !== null) {
    const [whole, underscoreId, braceId] = match;
    const id = underscoreId ?? braceId;
    const start = match.index;
    if (start > lastIndex) segments.push({ kind: 'text', text: template.slice(lastIndex, start) });
    segments.push({ kind: 'blank', id });
    lastIndex = start + whole.length;
  }
  if (lastIndex < template.length) segments.push({ kind: 'text', text: template.slice(lastIndex) });
  return segments;
}

function parseInitialValues(lastResponse: unknown): Record<string, string> {
  if (!lastResponse || typeof lastResponse !== 'object') return {};
  const answer = (lastResponse as { answer?: unknown }).answer;
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answer)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  return out;
}

/**
 * Instance pool key. Token labels can repeat (e.g. two blanks both want `var`),
 * so each chip needs a stable identity that's distinct from its label.
 */
type PoolEntry = { key: string; label: string };

/** Build the stable pool of (key, label) pairs from the payload. */
function buildPool(payload: FillBlankPayload): PoolEntry[] {
  if (payload.tokens && payload.tokens.length > 0) {
    return payload.tokens.map((label, i) => ({ key: `t${i}`, label }));
  }
  const seen = new Set<string>();
  const out: PoolEntry[] = [];
  for (const b of payload.blanks) {
    const label = b.expected[0];
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push({ key: `t${out.length}`, label });
    }
  }
  return out;
}

/** Source the user is dragging from. */
type DragSource =
  | { kind: 'pool'; tokenKey: string }
  | { kind: 'slot'; tokenKey: string; blankId: string };

const DRAG_MIME = 'application/x-bc-token';

export function FillBlankExercise({ exercise, onAttempt }: { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void }) {
  const payload = exercise.payload as FillBlankPayload;
  const segments = useMemo(() => tokenize(payload.template), [payload.template]);
  const pool = useMemo(() => buildPool(payload), [payload]);
  const tint: DnDTint = payload.language === 'kotlin' ? 'kotlin' : 'swift';
  const langLabel = (payload.language ?? 'swift').toUpperCase();
  const { user, setTotalPoints } = useAuth();

  // assignments[blankId] = pool entry key. Absent = empty slot.
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    seedAssignments(parseInitialValues(exercise.lastResponse), pool),
  );
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetUnlock, setResetUnlock] = useState(false);

  // Drag state. `dragSource` is the source of the active drag; the others are
  // visual hints for drop-target highlighting.
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);
  const [hoverPool, setHoverPool] = useState(false);

  const passedOnLoad = exercise.attemptStatus !== 'unattempted';
  const locked = passedOnLoad && !resetUnlock && !result;
  // Lock interaction only on a passing result. Wrong attempts must remain
  // editable so the learner can rearrange tokens and resubmit. The drag
  // handlers call `bumpResultClear()`, which already clears stale `result`
  // state on each placement.
  const showResultPassed = result?.passed === true;
  const interactive = !locked && !showResultPassed;

  const usedKeys = new Set(Object.values(assignments));
  const allFilled = segments
    .filter((s): s is Extract<Segment, { kind: 'blank' }> => s.kind === 'blank')
    .every((s) => assignments[s.id]);

  function bumpResultClear() {
    setResult(null);
    setAuthError(null);
  }

  /** Click-to-place: drop the next available token into the next empty slot. */
  function placeToken(tokenKey: string) {
    if (!interactive) return;
    if (usedKeys.has(tokenKey)) return;
    const nextEmpty = segments.find(
      (s) => s.kind === 'blank' && !assignments[s.id],
    ) as Extract<Segment, { kind: 'blank' }> | undefined;
    if (!nextEmpty) return;
    bumpResultClear();
    setAssignments((prev) => ({ ...prev, [nextEmpty.id]: tokenKey }));
  }

  /** Click-to-clear: remove a placed token back to the pool. */
  function clearSlot(blankId: string) {
    if (!interactive) return;
    if (!assignments[blankId]) return;
    bumpResultClear();
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[blankId];
      return next;
    });
  }

  /** Drop a token (from pool or another slot) onto a target slot. */
  function dropOnSlot(targetBlankId: string, source: DragSource) {
    bumpResultClear();
    setAssignments((prev) => {
      const next = { ...prev };
      const targetCurrentKey = next[targetBlankId];

      if (source.kind === 'slot') {
        // Moving from one slot to another. If the target was filled, swap so
        // we never silently lose the token already there.
        if (source.blankId === targetBlankId) return prev;
        delete next[source.blankId];
        next[targetBlankId] = source.tokenKey;
        if (targetCurrentKey) next[source.blankId] = targetCurrentKey;
        return next;
      }

      // Pool → slot. If the slot was filled, the previous token bumps back to
      // the pool (no auto-claim of another empty slot).
      next[targetBlankId] = source.tokenKey;
      return next;
    });
  }

  /** Drop a placed token back into the pool (clears its slot). */
  function dropOnPool(source: DragSource) {
    if (source.kind !== 'slot') return;
    bumpResultClear();
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[source.blankId];
      return next;
    });
  }

  // ── Drag handlers ──
  function onTokenDragStart(e: React.DragEvent, tokenKey: string) {
    if (!interactive || usedKeys.has(tokenKey)) {
      e.preventDefault();
      return;
    }
    setDragSource({ kind: 'pool', tokenKey });
    try {
      e.dataTransfer.setData(DRAG_MIME, tokenKey);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      /* jsdom and some browsers don't support custom MIME — state is the source of truth */
    }
  }

  function onSlotDragStart(e: React.DragEvent, blankId: string) {
    if (!interactive) { e.preventDefault(); return; }
    const tokenKey = assignments[blankId];
    if (!tokenKey) { e.preventDefault(); return; }
    setDragSource({ kind: 'slot', tokenKey, blankId });
    try {
      e.dataTransfer.setData(DRAG_MIME, tokenKey);
      e.dataTransfer.effectAllowed = 'move';
    } catch { /* ignore */ }
  }

  function onSlotDragOver(e: React.DragEvent, blankId: string) {
    if (!interactive || !dragSource) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
    setHoverSlotId(blankId);
  }

  function onSlotDrop(e: React.DragEvent, blankId: string) {
    e.preventDefault();
    if (!interactive || !dragSource) return;
    dropOnSlot(blankId, dragSource);
    resetDragState();
  }

  function onPoolDragOver(e: React.DragEvent) {
    if (!interactive || !dragSource || dragSource.kind !== 'slot') return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch { /* ignore */ }
    setHoverPool(true);
  }

  function onPoolDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!interactive || !dragSource) return;
    dropOnPool(dragSource);
    resetDragState();
  }

  function resetDragState() {
    setDragSource(null);
    setHoverSlotId(null);
    setHoverPool(false);
  }

  function onReset() {
    setResetUnlock(true);
    setAssignments({});
    setResult(null);
    setAuthError(null);
  }

  async function onSubmit() {
    if (!user) {
      setAuthError('Sign in to submit.');
      setResult(null);
      return;
    }
    setSubmitting(true);
    setResult(null);
    setAuthError(null);
    try {
      const answer = mapAssignmentsToAnswer(assignments, pool);
      const res = await submitExercise(exercise.id, exercise.version, { answer });
      setResult(res);
      if (res.passed) setTotalPoints(res.totalPoints);
      if (res.passed && onAttempt) onAttempt(res.newAttemptStatus);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack>
      {locked && <LockedNotice onReset={onReset} />}

      <CodeFrame
        tabs={[{ label: filenameForLanguage(payload.language), active: true }]}
        rightSlot={
          <Badge tone={payload.language === 'kotlin' ? 'amber' : 'iris'} mono>
            {langLabel}
          </Badge>
        }
      >
        <pre className="mono" style={{ margin: 0, fontSize: 'var(--t-sm)', lineHeight: 2.2, whiteSpace: 'pre-wrap' }}>
          {segments.map((s, i) => {
            if (s.kind === 'text') return <Fragment key={i}>{s.text}</Fragment>;
            const assignedKey = assignments[s.id];
            const filled = !!assignedKey;
            const label = filled ? pool.find((p) => p.key === assignedKey)?.label ?? '' : 'drop';
            const slotState = result
              ? result.passed
                ? 'correct'
                : 'wrong'
              : undefined;
            const isHover = hoverSlotId === s.id && !!dragSource;
            return (
              <DnDSlot
                key={i}
                role="button"
                aria-label={`blank-${s.id}`}
                aria-disabled={!interactive || undefined}
                tabIndex={interactive ? 0 : -1}
                draggable={interactive && filled}
                filled={filled}
                tint={filled ? tint : undefined}
                className={[slotState, isHover && 'drop-target'].filter(Boolean).join(' ') || undefined}
                onClick={() => clearSlot(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    clearSlot(s.id);
                  }
                }}
                onDragStart={(e) => onSlotDragStart(e, s.id)}
                onDragEnd={resetDragState}
                onDragOver={(e) => onSlotDragOver(e, s.id)}
                onDragLeave={() => setHoverSlotId((cur) => (cur === s.id ? null : cur))}
                onDrop={(e) => onSlotDrop(e, s.id)}
              >
                {label}
              </DnDSlot>
            );
          })}
        </pre>
      </CodeFrame>

      {pool.length > 0 && (
        <Stack gap="tight">
          <Eyebrow as="span">Available tokens</Eyebrow>
          <div
            role="list"
            aria-label="Available tokens"
            className={hoverPool ? 'dnd-pool drop-target' : 'dnd-pool'}
            onDragOver={onPoolDragOver}
            onDragLeave={() => setHoverPool(false)}
            onDrop={onPoolDrop}
          >
            {pool.map((p) => {
              const used = usedKeys.has(p.key);
              const dragging = dragSource?.kind === 'pool' && dragSource.tokenKey === p.key;
              return (
                <DnDToken
                  key={p.key}
                  used={used}
                  disabled={!interactive || used}
                  draggable={interactive && !used}
                  aria-label={`token-${p.label}`}
                  className={dragging ? 'dragging' : undefined}
                  onClick={() => placeToken(p.key)}
                  onDragStart={(e) => onTokenDragStart(e, p.key)}
                  onDragEnd={resetDragState}
                >
                  {p.label}
                </DnDToken>
              );
            })}
          </div>
        </Stack>
      )}

      <div>
        <Button variant="primary" onClick={onSubmit} disabled={submitting || locked || !allFilled}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>

      {authError && <Callout tone="danger" size="sm">{authError}</Callout>}
      {result && (
        <Stack gap="tight">
          <CheckResult result={result} />
          <PointsBadge passed={result.passed} pointsAwarded={result.pointsAwarded} totalPoints={result.totalPoints} />
          {result.newBadges && <BadgeUnlock badges={result.newBadges} />}
        </Stack>
      )}
    </Stack>
  );
}

function seedAssignments(answer: Record<string, string>, pool: PoolEntry[]): Record<string, string> {
  if (Object.keys(answer).length === 0) return {};
  const out: Record<string, string> = {};
  const claimed = new Set<string>();
  for (const [blankId, label] of Object.entries(answer)) {
    const entry = pool.find((p) => p.label === label && !claimed.has(p.key));
    if (entry) {
      out[blankId] = entry.key;
      claimed.add(entry.key);
    }
  }
  return out;
}

function mapAssignmentsToAnswer(
  assignments: Record<string, string>,
  pool: PoolEntry[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [blankId, key] of Object.entries(assignments)) {
    const entry = pool.find((p) => p.key === key);
    if (entry) out[blankId] = entry.label;
  }
  return out;
}

function filenameForLanguage(lang: string | undefined): string {
  if (lang === 'kotlin') return 'Main.kt';
  return 'ContentView.swift';
}
