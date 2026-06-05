'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { installLanguageServices } from '@/lib/monaco';

// Self-hosted Monaco (see CodeMonacoEditor). Loaded client-only because
// monaco-editor/esm touches the DOM at import time and must stay out of the
// server/RSC bundle. This also replaces the default runtime CDN fetch that was
// breaking autocomplete in production.
const Editor = dynamic(() => import('./CodeMonacoEditor'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: '100%', display: 'grid', placeItems: 'center' }}
      className="muted"
    >
      Loading editor…
    </div>
  ),
});
import type {
  ExerciseDTO,
  CodePayload,
  FixBugPayload,
  ExerciseAttemptStatus,
} from '@/lib/exercise-payloads';
import { runExercise, type RunResponse } from '@/lib/run';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import {
  Badge, Button, Callout, Card, CodeFrame, Eyebrow, Icon, Row, Stack,
} from '@/components/ui';
import { LockedNotice } from './_shared';
import { RunResult } from './RunResult';
import { PointsBadge } from './PointsBadge';
import { BadgeUnlock } from './BadgeUnlock';
import { AIReview } from './AIReview';
import { InstructorReview } from './InstructorReview';
import { useAuth } from '@/components/layout/AuthProvider';

function parseInitialCode(lastResponse: unknown, fallback: string): string {
  if (!lastResponse || typeof lastResponse !== 'object') return fallback;
  const code = (lastResponse as { code?: unknown }).code;
  return typeof code === 'string' ? code : fallback;
}

/**
 * Editor-based exercise renderer used for both `code` and `fix_bug` payloads.
 *
 * Both types share the same Monaco-based UX (run/submit, hints, output panel,
 * AI / instructor review). The only differences are the source of the starter
 * text, the file name, and a small "buggy" badge for fix-the-bug exercises.
 * Keeping them in one renderer avoids drift between the two flows.
 */
export function CodeExercise({ exercise, onAttempt }: { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void }) {
  const isFixBug = exercise.type === 'fix_bug';
  const starterCode = isFixBug
    ? (exercise.payload as FixBugPayload).brokenCode
    : (exercise.payload as CodePayload).starterCode;
  const language = (exercise.payload as CodePayload | FixBugPayload).language;

  const hints = exercise.hints ?? [];
  const [code, setCode] = useState(() => parseInitialCode(exercise.lastResponse, starterCode));
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [submitAttemptId, setSubmitAttemptId] = useState<string | null>(null);
  const [resetUnlock, setResetUnlock] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const { user, setTotalPoints } = useAuth();

  const passedOnLoad = exercise.attemptStatus !== 'unattempted';
  const locked = passedOnLoad && !resetUnlock && !submitResult;
  const langLabel = (language ?? 'swift').toUpperCase();
  const fileName = isFixBug
    ? (language === 'kotlin' ? 'Buggy.kt' : 'buggy.swift')
    : (language === 'kotlin' ? 'Main.kt' : 'main.swift');

  function onReset() {
    setResetUnlock(true);
    setCode(starterCode);
    setRunResult(null);
    setSubmitResult(null);
    setSubmitAttemptId(null);
    setHintsRevealed(0);
  }

  function onShowHint() {
    if (hintsRevealed < hints.length) setHintsRevealed((n) => n + 1);
  }

  async function onRun() {
    if (!user) {
      setRunResult({
        outcome: 'internal_error', passed: false, stdout: '',
        stderr: 'Sign in to run code.', durationMs: 0, timedOut: false,
      });
      setSubmitResult(null);
      return;
    }
    setRunning(true);
    setRunResult(null);
    setSubmitResult(null);
    setSubmitAttemptId(null);
    try {
      const res = await runExercise(exercise.id, exercise.version, code);
      setRunResult(res);
    } finally {
      setRunning(false);
    }
  }

  async function onSubmit() {
    if (!user) {
      setSubmitResult({
        passed: false, pointsAwarded: 0, totalPointsExercise: 0, totalPoints: 0,
        outcome: 'internal_error',
        stderr: 'Sign in to submit.',
        attemptId: '',
        newAttemptStatus: 'unattempted',
      });
      setRunResult(null);
      return;
    }
    setSubmitting(true);
    setRunResult(null);
    setSubmitResult(null);
    try {
      const res = await submitExercise(exercise.id, exercise.version, { code });
      setSubmitResult(res);
      setSubmitAttemptId(res.attemptId || null);
      if (res.passed) setTotalPoints(res.totalPoints);
      if (res.passed && onAttempt) onAttempt(res.newAttemptStatus);
    } finally {
      setSubmitting(false);
    }
  }

  const submitAsRunResult: RunResponse | null = submitResult
    ? {
        outcome: (submitResult.outcome ?? 'internal_error') as RunResponse['outcome'],
        passed: submitResult.passed,
        stdout: submitResult.stdout ?? '',
        stderr: submitResult.stderr ?? '',
        durationMs: 0,
        timedOut: false,
      }
    : null;

  const displayResult = runResult ?? submitAsRunResult;
  const allHintsShown = hints.length > 0 && hintsRevealed >= hints.length;

  return (
    <Stack>
      {locked && <LockedNotice onReset={onReset} />}

      <div className="code-ex-grid">
        <div className="code-ex-editor">
          <CodeFrame
            tabs={[{ label: fileName, active: true }]}
            rightSlot={
              <Row style={{ gap: 6 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  leadingIcon={<Icon name="refresh" size={12} />}
                  title="Reset to the starter code"
                >
                  Reset
                </Button>
                {hints.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onShowHint}
                    disabled={allHintsShown}
                    leadingIcon={<Icon name="bookmark" size={12} />}
                    title={allHintsShown ? 'All hints revealed' : 'Reveal the next hint'}
                  >
                    Hint
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRun}
                  disabled={running || submitting}
                  leadingIcon={<Icon name="play" size={12} />}
                >
                  {running ? 'Running…' : 'Run'}
                </Button>
                {isFixBug && (
                  <Badge
                    mono
                    style={{
                      color: 'var(--danger-400)',
                      borderColor: 'color-mix(in oklch, var(--danger-400) 30%, transparent)',
                      background: 'color-mix(in oklch, var(--danger-400) 12%, transparent)',
                    }}
                  >
                    buggy
                  </Badge>
                )}
                <Badge tone={language === 'kotlin' ? 'amber' : 'iris'} mono>
                  {langLabel}
                </Badge>
              </Row>
            }
          >
            <div style={{ height: 440, marginInline: -18, marginBlock: -16 }}>
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(v) => setCode(v ?? '')}
                theme="vs-dark"
                beforeMount={(monaco) => installLanguageServices(monaco)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  renderLineHighlight: 'all',
                  readOnly: locked,
                  // IDE-quality completion experience.
                  quickSuggestions: { other: true, comments: false, strings: false },
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter: 'on',
                  parameterHints: { enabled: true, cycle: true },
                  suggest: { showSnippets: true, snippetsPreventQuickSuggestions: false },
                  wordBasedSuggestions: 'currentDocument',
                }}
              />
            </div>
          </CodeFrame>
        </div>

        <Card className="code-ex-output">
          <Eyebrow>Output &amp; tests</Eyebrow>
          <div className="code-ex-output-body">
            {displayResult ? (
              <RunResult result={displayResult} />
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 'var(--t-sm)' }}>
                Press Run to see the output.
              </p>
            )}
          </div>
        </Card>
      </div>

      {hintsRevealed > 0 && (
        <Stack gap="tight">
          {hints.slice(0, hintsRevealed).map((h, i) => (
            <Callout
              key={i}
              tone="info"
              size="sm"
              title={`Hint ${i + 1} of ${hints.length}`}
              icon={<Icon name="bookmark" size={12} />}
            >
              {h}
            </Callout>
          ))}
        </Stack>
      )}

      <div className="code-ex-submit">
        <Button
          variant="iridescent"
          onClick={onSubmit}
          disabled={running || submitting || locked}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>

      {submitResult && (
        <Stack gap="tight">
          <PointsBadge
            passed={submitResult.passed}
            pointsAwarded={submitResult.pointsAwarded}
            totalPoints={submitResult.totalPoints}
          />
          {submitResult.newBadges && <BadgeUnlock badges={submitResult.newBadges} />}
        </Stack>
      )}
      <AIReview attemptId={submitAttemptId} />
      <InstructorReview attemptId={submitAttemptId} />
    </Stack>
  );
}
