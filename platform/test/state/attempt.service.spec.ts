import { PrismaClient } from '@prisma/client';
import { AttemptService } from '../../src/state/services/attempt.service';
import { AttemptRepository } from '../../src/state/repositories/attempt.repository';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ScoringService } from '../../src/state/services/scoring.service';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('AttemptService', () => {
  let prisma: PrismaClient;
  let svc: AttemptService;
  let exerciseRepo: ExerciseRepository;

  let studentId: string;
  let exerciseId: string;

  beforeAll(() => {
    prisma = makeTestPrisma();
    const attemptRepo = new AttemptRepository(prisma as any);
    const resultRepo = new ExerciseResultRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    const scoring = new ScoringService();
    svc = new AttemptService(attemptRepo, resultRepo, exerciseRepo, scoring, prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);

    studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'A', email: `${studentId}@x.com` },
    });

    exerciseId = newId();
    await exerciseRepo.createDraft({
      id: exerciseId,
      lessonId: newId(),
      promptMarkdown: 'q',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: '',
        testCode: '',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: ['hint1', 'hint2'],
      concepts: ['x'],
    });
    await exerciseRepo.publish(exerciseId, 1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records a passing first attempt with full points and creates a rollup', async () => {
    const result = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'let x = 1' },
      passed: true,
      hintsUsedCount: 0,
    });

    expect(result.attempt.passed).toBe(true);
    expect(result.attempt.pointsAwarded).toBe(100);
    expect(result.attempt.failedAttemptsBefore).toBe(0);
    expect(result.exerciseResult.passed).toBe(true);
    expect(result.exerciseResult.pointsEarned).toBe(100);
    expect(result.exerciseResult.attemptsCount).toBe(1);
    expect(result.exerciseResult.firstPassedAt).not.toBeNull();
  });

  it('counts prior failed attempts and applies penalty', async () => {
    await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'wrong' },
      passed: false,
      hintsUsedCount: 0,
    });
    await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'wrong again' },
      passed: false,
      hintsUsedCount: 1,
    });

    const third = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'right' },
      passed: true,
      hintsUsedCount: 1,
    });

    // 2 failed attempts before (5% * 2 = 10%) + 1 hint (10%) = 80
    expect(third.attempt.failedAttemptsBefore).toBe(2);
    expect(third.attempt.pointsAwarded).toBe(80);
    expect(third.exerciseResult.passed).toBe(true);
    expect(third.exerciseResult.pointsEarned).toBe(80);
    expect(third.exerciseResult.attemptsCount).toBe(3);
  });

  it('keeps the highest pointsEarned across passing attempts', async () => {
    const first = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'ok' },
      passed: true,
      hintsUsedCount: 2, // 80 points
    });
    expect(first.exerciseResult.pointsEarned).toBe(80);

    const second = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'ok again' },
      passed: true,
      hintsUsedCount: 0,
    });
    // Second attempt: 100 - 0 hints - 0 failed = 100
    expect(second.attempt.pointsAwarded).toBe(100);
    expect(second.exerciseResult.pointsEarned).toBe(100);
  });

  it('rejects an attempt with a submission payload that does not match the exercise type', async () => {
    await expect(
      svc.recordAttempt({
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submissionPayload: {
          type: 'multiple_choice',
          selectedOptionIds: ['a'],
        } as any,
        passed: true,
        hintsUsedCount: 0,
      }),
    ).rejects.toThrow();
  });

  it('rejects an attempt referencing a non-existent exercise version', async () => {
    await expect(
      svc.recordAttempt({
        studentId,
        exerciseId,
        exerciseVersion: 99,
        submissionPayload: { type: 'code', code: 'x' },
        passed: true,
        hintsUsedCount: 0,
      }),
    ).rejects.toThrow();
  });
});
