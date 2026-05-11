'use client';
import { useState } from 'react';
import type { ExerciseDTO, MultipleChoicePayload, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import { Button, Callout, Choice, Stack } from '@/components/ui';
import { CheckResult, LockedNotice } from './_shared';
import { PointsBadge } from './PointsBadge';
import { BadgeUnlock } from './BadgeUnlock';
import { useAuth } from '@/components/layout/AuthProvider';
import { ExplanationBlock } from '../ExplanationBlock';

function parseInitialSelection(lastResponse: unknown): Set<string> {
  if (!lastResponse || typeof lastResponse !== 'object') return new Set();
  const answer = (lastResponse as { answer?: unknown }).answer;
  if (Array.isArray(answer) && answer.every((v) => typeof v === 'string')) {
    return new Set(answer);
  }
  return new Set();
}

export function MultipleChoiceExercise({ exercise, onAttempt }: { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void }) {
  const payload = exercise.payload as MultipleChoicePayload;
  const initialSelection = parseInitialSelection(exercise.lastResponse);
  const [selected, setSelected] = useState<Set<string>>(initialSelection);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetUnlock, setResetUnlock] = useState(false);
  const { user, setTotalPoints } = useAuth();

  const passedOnLoad = exercise.attemptStatus !== 'unattempted';
  const locked = passedOnLoad && !resetUnlock && !result;
  // Freeze interaction only when the attempt has succeeded — wrong attempts
  // should let the learner change their selection and resubmit.
  const showResultPassed = result?.passed === true;
  const inputsDisabled = locked || showResultPassed;

  function toggle(id: string) {
    if (inputsDisabled) return;
    setAuthError(null);
    // Clear stale "Not quite" feedback so the next submit is treated as fresh.
    if (result && !result.passed) setResult(null);
    if (payload.multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  }

  function onReset() {
    setResetUnlock(true);
    setSelected(new Set());
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
      const res = await submitExercise(exercise.id, exercise.version, { answer: Array.from(selected) });
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
      {/* Render the question through ExplanationBlock so backticks become
          inline code and **bold** etc. render properly. The previous
          plain-<p> wrapper was losing markdown formatting on questions
          that referenced API names like `if let`. */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ExplanationBlock markdown={payload.questionMarkdown} />
      </div>
      <Stack gap="tight">
        {payload.options.map((opt, i) => {
          const isPicked = selected.has(opt.id);
          const isCorrect = result?.passed && isPicked;
          const isWrong = result && !result.passed && isPicked;
          const state = isCorrect ? 'correct' : isWrong ? 'wrong' : isPicked ? 'picked' : 'idle';
          return (
            <Choice
              key={opt.id}
              state={state}
              disabled={inputsDisabled}
              keyLabel={String.fromCharCode(65 + i)}
              input={
                <input
                  type={payload.multiSelect ? 'checkbox' : 'radio'}
                  name={`mc-${exercise.id}`}
                  aria-label={opt.text}
                  checked={isPicked}
                  onChange={() => toggle(opt.id)}
                  disabled={inputsDisabled}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                />
              }
            >
              {opt.text}
            </Choice>
          );
        })}
      </Stack>
      <div>
        <Button variant="primary" onClick={onSubmit} disabled={selected.size === 0 || submitting || locked}>
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
