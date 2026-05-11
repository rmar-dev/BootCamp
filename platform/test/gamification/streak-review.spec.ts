import { PrismaClient } from '@prisma/client';
import { StreakService } from '../../src/gamification/streak.service';
import { AttemptRepository } from '../../src/state/repositories/attempt.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('StreakService — review-only days', () => {
  let prisma: PrismaClient;
  let svc: StreakService;

  beforeAll(() => {
    prisma = makeTestPrisma();
    const repo = new AttemptRepository(prisma as any);
    svc = new StreakService(repo, prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('counts a day where the student only has a ReviewAttempt (no Attempt)', async () => {
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'S', email: `s-${newId()}@t.com` },
    });

    // Today, only a review
    await prisma.reviewAttempt.create({
      data: {
        id: newId(), reviewCardId: newId(),
        studentId, exerciseId: newId(),
        submittedAt: new Date(), passed: true,
      },
    });

    const result = await svc.getCurrentStreak(studentId);

    expect(result.activeToday).toBe(true);
    expect(result.current).toBe(1);
  });

  it('extends a streak across a mixed day (Attempt + ReviewAttempt on different days)', async () => {
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'S', email: `s-${newId()}@t.com` },
    });

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const exerciseId = newId();
    await prisma.attempt.create({
      data: {
        id: newId(), studentId, exerciseId, exerciseVersion: 1,
        submittedAt: yesterday, submissionPayload: {},
        passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
      },
    });
    await prisma.reviewAttempt.create({
      data: {
        id: newId(), reviewCardId: newId(),
        studentId, exerciseId,
        submittedAt: new Date(), passed: true,
      },
    });

    const result = await svc.getCurrentStreak(studentId);
    expect(result.current).toBe(2);
    expect(result.activeToday).toBe(true);
  });
});
