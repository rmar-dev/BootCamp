export type RunOutcome =
  | 'passed'
  | 'failed'
  | 'compile_error'
  | 'timed_out'
  | 'internal_error';

export type RunResponse = {
  outcome: RunOutcome;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

function syntheticInternalError(message: string): RunResponse {
  return {
    outcome: 'internal_error',
    passed: false,
    stdout: '',
    stderr: message,
    durationMs: 0,
    timedOut: false,
  };
}

export async function runExercise(
  exerciseId: string,
  exerciseVersion: number,
  code: string,
): Promise<RunResponse> {
  try {
    const res = await fetch(`${BASE}/api/run`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, exerciseVersion, code }),
    });
    if (!res.ok) {
      return syntheticInternalError(`execution service returned ${res.status}`);
    }
    return (await res.json()) as RunResponse;
  } catch (err) {
    return syntheticInternalError(
      `could not reach execution service: ${(err as Error).message}`,
    );
  }
}
