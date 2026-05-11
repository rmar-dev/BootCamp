'use client';
import { useState } from 'react';
import type { ExerciseDTO, PredictOutputPayload, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import { Badge, Button, Callout, Choice, CodeFrame, Eyebrow, Stack } from '@/components/ui';
import { CheckResult, LockedNotice } from './_shared';
import { PointsBadge } from './PointsBadge';
import { BadgeUnlock } from './BadgeUnlock';
import { useAuth } from '@/components/layout/AuthProvider';

function parseInitialAnswer(lastResponse: unknown): string {
  if (!lastResponse || typeof lastResponse !== 'object') return '';
  const answer = (lastResponse as { answer?: unknown }).answer;
  return typeof answer === 'string' ? answer : '';
}

export function PredictOutputExercise({ exercise, onAttempt }: { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void }) {
  const payload = exercise.payload as PredictOutputPayload;
  const [value, setValue] = useState(() => parseInitialAnswer(exercise.lastResponse));
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetUnlock, setResetUnlock] = useState(false);
  const { user, setTotalPoints } = useAuth();

  const passedOnLoad = exercise.attemptStatus !== 'unattempted';
  const locked = passedOnLoad && !resetUnlock && !result;
  // Freeze inputs only after a successful attempt; wrong attempts must remain editable.
  const showResultPassed = result?.passed === true;
  const inputsDisabled = locked || showResultPassed;
  const langLabel = (payload.displayedLanguage ?? 'swift').toUpperCase();

  function onReset() {
    setResetUnlock(true);
    setValue('');
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
      const res = await submitExercise(exercise.id, exercise.version, { answer: value });
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
        tabs={[{ label: 'Read the code', active: true }]}
        rightSlot={
          <Badge tone={payload.displayedLanguage === 'kotlin' ? 'amber' : 'iris'} mono>
            {langLabel}
          </Badge>
        }
      >
        <pre className="mono" style={{ margin: 0, fontSize: 'var(--t-sm)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {payload.displayedCode}
        </pre>
      </CodeFrame>
      {payload.options && payload.options.length >= 2 ? (
        // Multiple-choice variant — picks one of the authored options.
        // Submission grading is identical (server compares to expectedOutput).
        <Stack gap="tight">
          <Eyebrow>Pick the predicted output</Eyebrow>
          {payload.options.map((opt, i) => {
            const isPicked = value === opt;
            const isCorrect = result?.passed && isPicked;
            const isWrong = result && !result.passed && isPicked;
            const state = isCorrect ? 'correct' : isWrong ? 'wrong' : isPicked ? 'picked' : 'idle';
            return (
              <Choice
                key={`${opt}-${i}`}
                state={state}
                disabled={inputsDisabled}
                keyLabel={String.fromCharCode(65 + i)}
                input={
                  <input
                    type="radio"
                    name={`predict-${exercise.id}`}
                    aria-label={opt}
                    checked={isPicked}
                    disabled={inputsDisabled}
                    onChange={() => {
                      if (inputsDisabled) return;
                      setValue(opt);
                      setResult(null);
                      setAuthError(null);
                    }}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                  />
                }
              >
                <pre className="mono" style={{ margin: 0, fontSize: 'var(--t-sm)', whiteSpace: 'pre-wrap' }}>
                  {opt}
                </pre>
              </Choice>
            );
          })}
        </Stack>
      ) : (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow as="span">Predicted output</Eyebrow>
          <textarea
            aria-label="predicted output"
            className="predict-answer"
            rows={3}
            value={value}
            spellCheck={false}
            disabled={locked}
            onChange={(e) => { if (!locked) { setValue(e.target.value); setResult(null); setAuthError(null); } }}
          />
        </label>
      )}
      <div>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={submitting || locked || (payload.options ? !value : false)}
        >
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
