export type RunOutcome =
  | 'passed'
  | 'failed'
  | 'compile_error'
  | 'timed_out'
  | 'internal_error';

export type RunRequest = {
  exerciseId: string;
  exerciseVersion: number;
  code: string;
};

export type RunResponse = {
  outcome: RunOutcome;
  passed: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

export type RunnerLanguage = 'swift' | 'kotlin';

export type DockerRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
};

export class SidecarUnavailableError extends Error {
  constructor(public readonly language: RunnerLanguage, cause?: unknown) {
    super(`sidecar for ${language} unavailable`);
    this.name = 'SidecarUnavailableError';
    if (cause) (this as any).cause = cause;
  }
}
