'use client';
import { useState } from 'react';
import type { ExerciseDTO, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import { Badge, Button, Eyebrow, Input, Stack } from '@/components/ui';
import { PointsBadge } from './PointsBadge';
import { InstructorReview } from './InstructorReview';
import { useAuth } from '@/components/layout/AuthProvider';

// onAttempt is accepted in the prop type but never invoked — capstone is instructor-graded.
export function CapstoneSubmissionExercise({ exercise }: { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void }) {
  const { setTotalPoints } = useAuth();
  const [repoUrl, setRepoUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [submitAttemptId, setSubmitAttemptId] = useState<string | null>(null);

  const isEmpty = !repoUrl.trim() || !commitSha.trim();

  async function onSubmit() {
    setSubmitting(true);
    try {
      const res = await submitExercise(exercise.id, exercise.version, {
        repoUrl: repoUrl.trim(),
        commitSha: commitSha.trim(),
        notes: notes.trim(),
      });
      setSubmitResult(res);
      setSubmitAttemptId(res.attemptId || null);
      if (res.passed) setTotalPoints(res.totalPoints);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Eyebrow as="span">Repository URL</Eyebrow>
        <Input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/you/your-project"
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Eyebrow as="span">Commit SHA</Eyebrow>
        <Input
          type="text"
          value={commitSha}
          onChange={(e) => setCommitSha(e.target.value)}
          placeholder="abc1234"
          className="mono"
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Eyebrow as="span">Notes</Eyebrow>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your build output or any notes for the instructor..."
          rows={5}
          className="predict-answer"
        />
      </label>

      <div>
        <Button variant="primary" onClick={onSubmit} disabled={isEmpty || submitting}>
          {submitting ? 'Submitting…' : 'Submit Milestone'}
        </Button>
      </div>

      {submitResult && (
        <Stack gap="tight">
          {submitResult.passed ? (
            <PointsBadge
              passed={submitResult.passed}
              pointsAwarded={submitResult.pointsAwarded}
              totalPoints={submitResult.totalPoints}
            />
          ) : (
            <Badge tone="amber" dot>Pending review</Badge>
          )}
        </Stack>
      )}

      <InstructorReview attemptId={submitAttemptId} />
    </Stack>
  );
}
