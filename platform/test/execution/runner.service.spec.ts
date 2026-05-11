import { NotFoundException } from '@nestjs/common';
import { RunnerService } from '../../src/execution/runner.service';
import { SidecarUnavailableError } from '../../src/execution/types';

const swiftCodeExercise = {
  id: 'ex-1', version: 1, type: 'code',
  payload: {
    type: 'code', language: 'swift', starterCode: '',
    testCode: 'assert(greet() == "hello")', testEntryPoint: 'greet',
  },
  publishedAt: new Date(),
};

function makeExerciseRepo(exercise: object | null) {
  return {
    findByVersion: jest.fn().mockResolvedValue(exercise),
  } as any;
}

function makeDockerRunner(result: object) {
  return {
    run: jest.fn().mockResolvedValue(result),
  } as any;
}

describe('RunnerService', () => {
  it('returns passed on exit 0', async () => {
    const svc = new RunnerService(
      makeExerciseRepo(swiftCodeExercise),
      makeDockerRunner({ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false, durationMs: 100 }),
    );
    const res = await svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'func greet() -> String { "hello" }' });
    expect(res.outcome).toBe('passed');
    expect(res.passed).toBe(true);
  });

  it('returns compile_error on exit 10', async () => {
    const svc = new RunnerService(
      makeExerciseRepo(swiftCodeExercise),
      makeDockerRunner({ stdout: '', stderr: 'compile fail', exitCode: 10, timedOut: false, durationMs: 100 }),
    );
    const res = await svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'bad code' });
    expect(res.outcome).toBe('compile_error');
    expect(res.passed).toBe(false);
  });

  it('returns timed_out on exit 124', async () => {
    const svc = new RunnerService(
      makeExerciseRepo(swiftCodeExercise),
      makeDockerRunner({ stdout: '', stderr: '', exitCode: 124, timedOut: true, durationMs: 5000 }),
    );
    const res = await svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'while true {}' });
    expect(res.outcome).toBe('timed_out');
    expect(res.timedOut).toBe(true);
    expect(res.passed).toBe(false);
  });

  it('returns failed on other non-zero exit', async () => {
    const svc = new RunnerService(
      makeExerciseRepo(swiftCodeExercise),
      makeDockerRunner({ stdout: '', stderr: 'assertion failed', exitCode: 1, timedOut: false, durationMs: 200 }),
    );
    const res = await svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'func greet() -> String { "wrong" }' });
    expect(res.outcome).toBe('failed');
    expect(res.passed).toBe(false);
  });

  it('returns internal_error when DockerRunner throws SidecarUnavailableError', async () => {
    const dockerRunner = {
      run: jest.fn().mockRejectedValue(new SidecarUnavailableError('swift')),
    } as any;
    const svc = new RunnerService(makeExerciseRepo(swiftCodeExercise), dockerRunner);
    const res = await svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'code' });
    expect(res.outcome).toBe('internal_error');
    expect(res.passed).toBe(false);
  });

  it('throws NotFoundException for missing exercise', async () => {
    const svc = new RunnerService(makeExerciseRepo(null), makeDockerRunner({}));
    await expect(svc.run({ exerciseId: 'missing', exerciseVersion: 1, code: 'code' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for unpublished exercise', async () => {
    const unpublished = { ...swiftCodeExercise, publishedAt: null };
    const svc = new RunnerService(makeExerciseRepo(unpublished), makeDockerRunner({}));
    await expect(svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'code' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('caps concurrency at 4 (launch 10 concurrent calls)', async () => {
    let activeCount = 0;
    let maxActive = 0;

    const dockerRunner = {
      run: jest.fn().mockImplementation(async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeCount--;
        return { stdout: '', stderr: '', exitCode: 0, timedOut: false, durationMs: 50 };
      }),
    } as any;

    const svc = new RunnerService(makeExerciseRepo(swiftCodeExercise), dockerRunner);

    const promises = Array.from({ length: 10 }, () =>
      svc.run({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'code' }),
    );

    await Promise.all(promises);
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(0);
  });
});
