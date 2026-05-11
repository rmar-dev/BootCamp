import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { DockerRunner } from './docker-runner';
import { buildHarness } from './harness';
import {
  RunRequest,
  RunResponse,
  RunOutcome,
  RunnerLanguage,
  SidecarUnavailableError,
} from './types';

const MAX_CONCURRENCY = 4;
const QUEUE_TIMEOUT_MS = 10_000;
const TOTAL_BUDGET_MS = 10_000;

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  // Semaphore state
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(
    private readonly exerciseRepo: ExerciseRepository,
    private readonly dockerRunner: DockerRunner,
  ) {}

  async run(req: RunRequest): Promise<RunResponse> {
    // 1. Fetch exercise
    const exercise = await this.exerciseRepo.findByVersion(req.exerciseId, req.exerciseVersion);
    if (!exercise || !exercise.publishedAt) {
      throw new NotFoundException(`Exercise ${req.exerciseId}@${req.exerciseVersion} not found`);
    }

    // 2. Validate exercise type and language
    const payload = exercise.payload as any;
    if (
      (exercise.type !== 'code' && exercise.type !== 'fix_bug') ||
      !payload?.language ||
      !['swift', 'kotlin'].includes(payload.language)
    ) {
      throw new NotFoundException(`Exercise ${req.exerciseId} is not a runnable code exercise`);
    }

    const language = payload.language as RunnerLanguage;
    const testCode: string = payload.testCode ?? '';

    // 3. Build harness
    const source = buildHarness(language, req.code, testCode);

    // 4. Acquire semaphore slot
    await this.acquireSlot();

    try {
      // 5. Run via Docker
      const result = await this.dockerRunner.run(language, source, TOTAL_BUDGET_MS);

      // 6. Map to RunResponse
      let outcome: RunOutcome;
      if (result.timedOut || result.exitCode === 124) {
        outcome = 'timed_out';
      } else if (result.exitCode === 0) {
        outcome = 'passed';
      } else if (result.exitCode === 10) {
        outcome = 'compile_error';
      } else {
        outcome = 'failed';
      }

      return {
        outcome,
        passed: outcome === 'passed',
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
      };
    } catch (err) {
      if (err instanceof SidecarUnavailableError) {
        this.logger.warn(`Sidecar unavailable for language ${err.language}`);
        return {
          outcome: 'internal_error',
          passed: false,
          stdout: '',
          stderr: '',
          durationMs: 0,
          timedOut: false,
        };
      }
      throw err;
    } finally {
      // 7. Release semaphore slot
      this.releaseSlot();
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.active < MAX_CONCURRENCY) {
      this.active++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        this.logger.warn('Queue saturated: run request timed out waiting for slot');
        reject(new Error('queue_saturated'));
      }, QUEUE_TIMEOUT_MS);

      const waiter = () => {
        clearTimeout(timer);
        this.active++;
        resolve();
      };

      this.waiters.push(waiter);
    });
  }

  private releaseSlot(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    } else {
      this.active--;
    }
  }
}
