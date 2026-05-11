import type { ExerciseAttemptStatus } from './exercise-payloads';
import { getApiBase } from './api-base';

export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: string;
  stdout?: string;
  stderr?: string;
  newBadges?: Array<{ id: string; name: string; icon: string }>;
  attemptId: string;
  newAttemptStatus: ExerciseAttemptStatus;
};

const BASE = getApiBase();

export async function submitExercise(
  exerciseId: string,
  exerciseVersion: number,
  payload: { code: string } | { answer: unknown } | { repoUrl: string; commitSha: string; notes: string },
): Promise<SubmitResponse> {
  try {
    const res = await fetch(`${BASE}/api/submit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, exerciseVersion, ...payload }),
    });
    if (!res.ok) throw new Error(`submit returned ${res.status}`);
    return (await res.json()) as SubmitResponse;
  } catch (err) {
    return {
      passed: false, pointsAwarded: 0, totalPointsExercise: 0, totalPoints: 0,
      outcome: 'internal_error',
      stderr: `could not reach submission service: ${(err as Error).message}`,
      newBadges: [],
      attemptId: '',
      newAttemptStatus: 'unattempted',
    };
  }
}
