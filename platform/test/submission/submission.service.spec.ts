import { NotFoundException } from '@nestjs/common';
import { SubmissionService } from '../../src/submission/submission.service';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { RunnerService } from '../../src/execution/runner.service';
import { AttemptService } from '../../src/state/services/attempt.service';
import { EnsureStudentService } from '../../src/submission/ensure-student';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { BadgeService } from '../../src/gamification/badge.service';
import { ReviewService } from '../../src/review/review.service';
import { ReviewQueueService } from '../../src/review-queue/review-queue.service';

function makeExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex1',
    version: 1,
    type: 'multiple_choice',
    publishedAt: new Date(),
    pointsMax: 100,
    payload: {
      type: 'multiple_choice',
      questionMarkdown: 'Which?',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionIds: ['a'],
      multiSelect: false,
    },
    ...overrides,
  };
}

function makeService(overrides: {
  findByVersion?: jest.Mock;
  run?: jest.Mock;
  recordAttempt?: jest.Mock;
  ensureStudent?: jest.Mock;
  listByStudent?: jest.Mock;
  checkAndAward?: jest.Mock;
  generateReview?: jest.Mock;
  handleSubmission?: jest.Mock;
  findManyAttempt?: jest.Mock;
} = {}) {
  const findByVersion = overrides.findByVersion ?? jest.fn().mockResolvedValue(makeExercise());
  const run = overrides.run ?? jest.fn();
  const recordAttempt = overrides.recordAttempt ?? jest.fn().mockResolvedValue({
    attempt: { id: 'attempt-1', pointsAwarded: 100 },
    exerciseResult: { pointsEarned: 100 },
  });
  const ensureStudent = overrides.ensureStudent ?? jest.fn().mockResolvedValue({ id: 'stu1' });
  const listByStudent = overrides.listByStudent ?? jest.fn().mockResolvedValue([{ pointsEarned: 100 }]);
  const checkAndAward = overrides.checkAndAward ?? jest.fn().mockResolvedValue([]);
  const generateReview = overrides.generateReview ?? jest.fn().mockResolvedValue(undefined);
  const handleSubmission = overrides.handleSubmission ?? jest.fn().mockResolvedValue(undefined);
  const findManyAttempt = overrides.findManyAttempt ?? jest.fn().mockResolvedValue([]);

  const exercises = { findByVersion } as unknown as ExerciseRepository;
  const runner = { run } as unknown as RunnerService;
  const attemptService = { recordAttempt } as unknown as AttemptService;
  const ensureStudentSvc = { ensureStudent } as unknown as EnsureStudentService;
  const results = { listByStudent } as unknown as ExerciseResultRepository;
  const badgeService = { checkAndAward } as unknown as BadgeService;
  const reviewService = { generateReview } as unknown as ReviewService;
  const reviewQueueService = { handleSubmission } as unknown as ReviewQueueService;
  const prisma = { attempt: { findMany: findManyAttempt } } as unknown as any;

  const svc = new SubmissionService(exercises, runner, attemptService, ensureStudentSvc, results, badgeService, reviewService, reviewQueueService, prisma);
  return { svc, findByVersion, run, recordAttempt, ensureStudent, listByStudent, checkAndAward, generateReview, handleSubmission, findManyAttempt };
}

describe('SubmissionService', () => {
  it('MC correct → passed=true, pointsAwarded=100, totalPoints=100', async () => {
    const { svc } = makeService();
    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      answer: ['a'],
    });
    expect(result.passed).toBe(true);
    expect(result.pointsAwarded).toBe(100);
    expect(result.totalPoints).toBe(100);
  });

  it('MC wrong → passed=false, pointsAwarded=0', async () => {
    const { svc } = makeService({
      recordAttempt: jest.fn().mockResolvedValue({
        attempt: { pointsAwarded: 0 },
        exerciseResult: { pointsEarned: 0 },
      }),
      listByStudent: jest.fn().mockResolvedValue([{ pointsEarned: 0 }]),
    });
    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      answer: ['b'],
    });
    expect(result.passed).toBe(false);
    expect(result.pointsAwarded).toBe(0);
  });

  it('code → delegates to RunnerService, returns outcome/stdout/stderr', async () => {
    const run = jest.fn().mockResolvedValue({
      outcome: 'passed',
      passed: true,
      stdout: 'ok',
      stderr: '',
      durationMs: 10,
      timedOut: false,
    });
    const { svc } = makeService({
      findByVersion: jest.fn().mockResolvedValue(
        makeExercise({
          type: 'code',
          payload: {
            type: 'code',
            language: 'swift',
            starterCode: '',
            testCode: '',
            testEntryPoint: 'runTests',
          },
        }),
      ),
      run,
    });

    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      code: 'let x = 1',
    });

    expect(run).toHaveBeenCalledWith({
      exerciseId: 'ex1',
      exerciseVersion: 1,
      code: 'let x = 1',
    });
    expect(result.passed).toBe(true);
    expect(result.outcome).toBe('passed');
    expect(result.stdout).toBe('ok');
    expect(result.stderr).toBe('');
  });

  it('throws 404 for missing exercise', async () => {
    const { svc } = makeService({
      findByVersion: jest.fn().mockResolvedValue(null),
    });
    await expect(
      svc.submit('user1', { exerciseId: 'missing', exerciseVersion: 1, answer: ['a'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 404 for unpublished exercise', async () => {
    const { svc } = makeService({
      findByVersion: jest.fn().mockResolvedValue(
        makeExercise({ publishedAt: null }),
      ),
    });
    await expect(
      svc.submit('user1', { exerciseId: 'ex1', exerciseVersion: 1, answer: ['a'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('calls ensureStudent with the provided userId', async () => {
    const { svc, ensureStudent } = makeService();
    await svc.submit('user-abc', { exerciseId: 'ex1', exerciseVersion: 1, answer: ['a'] });
    expect(ensureStudent).toHaveBeenCalledWith('user-abc');
  });

  it('newAttemptStatus = first_try when findMany returns [{passed:true}] and submit passes', async () => {
    const { svc } = makeService({
      findManyAttempt: jest.fn().mockResolvedValue([{ passed: true }]),
    });
    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      answer: ['a'],
    });
    expect(result.passed).toBe(true);
    expect(result.newAttemptStatus).toBe('first_try');
  });

  it('newAttemptStatus = eventual when findMany returns [{passed:false},{passed:true}]', async () => {
    const { svc } = makeService({
      findManyAttempt: jest.fn().mockResolvedValue([{ passed: false }, { passed: true }]),
    });
    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      answer: ['a'],
    });
    expect(result.newAttemptStatus).toBe('eventual');
  });

  it('newAttemptStatus = unattempted when submission failed and findMany returns [{passed:false}]', async () => {
    const { svc } = makeService({
      recordAttempt: jest.fn().mockResolvedValue({
        attempt: { id: 'attempt-1', pointsAwarded: 0 },
        exerciseResult: { pointsEarned: 0 },
      }),
      listByStudent: jest.fn().mockResolvedValue([{ pointsEarned: 0 }]),
      findManyAttempt: jest.fn().mockResolvedValue([{ passed: false }]),
    });
    const result = await svc.submit('user1', {
      exerciseId: 'ex1',
      exerciseVersion: 1,
      answer: ['b'], // wrong answer → passed=false
    });
    expect(result.passed).toBe(false);
    expect(result.newAttemptStatus).toBe('unattempted');
  });
});
