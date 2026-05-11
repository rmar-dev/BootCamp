// src/content/services/attempt-status.util.ts
import { ExerciseAttemptStatus } from '../types/attempt-status';

export function computeStatus(rows: ReadonlyArray<{ passed: boolean }>): ExerciseAttemptStatus {
  if (rows.length === 0) return 'unattempted';
  if (rows[0].passed) return 'first_try';
  if (rows.some((r) => r.passed)) return 'eventual';
  return 'unattempted';
}
