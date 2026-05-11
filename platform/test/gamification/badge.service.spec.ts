import { BadgeService, BadgeCheckContext } from '../../src/gamification/badge.service';
import { BadgeRepository } from '../../src/gamification/badge.repository';
import { StreakService } from '../../src/gamification/streak.service';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ProgressService } from '../../src/state/services/progress.service';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { EnrollmentRepository } from '../../src/state/repositories/enrollment.repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Attempt, Badge, ExerciseResult, ExerciseType } from '@prisma/client';
import { newId } from '../../src/shared/ids';

// The 8 system badges, mirroring what migration 20260510000000 seeds.
function systemBadges(): Badge[] {
  const base = (
    code: string,
    name: string,
    criteriaKind: Badge['criteriaKind'],
  ): Badge => ({
    id: newId(),
    code,
    name,
    description: name,
    icon: '⭐',
    criteriaKind,
    thresholdValue: null,
    scopeKind: 'public',
    scopeId: null,
    authorUserId: null,
    system: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return [
    base('first_submit', 'First Submission', 'system_first_submit'),
    base('first_pass', 'First Pass', 'system_first_pass'),
    base('streak_3', '3-Day Streak', 'system_streak_3'),
    base('streak_7', '7-Day Streak', 'system_streak_7'),
    base('all_types', 'Versatile', 'system_all_types'),
    base('points_100', 'Century', 'system_points_100'),
    base('points_500', 'High Scorer', 'system_points_500'),
    base('perfect_lesson', 'Perfect Lesson', 'system_perfect_lesson'),
  ];
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: newId(),
    studentId: newId(),
    exerciseId: newId(),
    exerciseVersion: 1,
    submittedAt: new Date(),
    submissionPayload: {},
    passed: true,
    hintsUsedCount: 0,
    failedAttemptsBefore: 0,
    pointsAwarded: 10,
    ...overrides,
  } as Attempt;
}

function makeResult(overrides: Partial<ExerciseResult> = {}): ExerciseResult {
  return {
    id: newId(),
    studentId: newId(),
    exerciseId: newId(),
    bestAttemptId: newId(),
    passed: true,
    pointsEarned: 10,
    attemptsCount: 1,
    firstPassedAt: new Date(),
    ...overrides,
  } as ExerciseResult;
}

function makeCtx(overrides: Partial<BadgeCheckContext> = {}): BadgeCheckContext {
  return {
    attempt: makeAttempt(),
    exerciseResult: makeResult(),
    totalPoints: 10,
    exerciseType: 'multiple_choice',
    exerciseId: newId(),
    lessonId: newId(),
    lessonVersion: 1,
    ...overrides,
  };
}

type Mocks = {
  badgeRepo: jest.Mocked<BadgeRepository>;
  streakSvc: jest.Mocked<StreakService>;
  results: jest.Mocked<ExerciseResultRepository>;
  exercises: jest.Mocked<ExerciseRepository>;
  progress: jest.Mocked<ProgressService>;
  students: jest.Mocked<StudentRepository>;
  enrollments: jest.Mocked<EnrollmentRepository>;
  prisma: jest.Mocked<PrismaService>;
};

function makeService(visibleBadges: Badge[] = systemBadges()): { service: BadgeService } & Mocks {
  const badgeRepo = {
    hasBadge: jest.fn().mockResolvedValue(false),
    award: jest.fn().mockResolvedValue({}),
    findByStudent: jest.fn().mockResolvedValue([]),
    findAllVisibleToStudent: jest.fn().mockResolvedValue(visibleBadges),
    findById: jest.fn(),
  } as unknown as jest.Mocked<BadgeRepository>;

  const streakSvc = {
    getCurrentStreak: jest.fn().mockResolvedValue({ current: 0, activeToday: false }),
  } as unknown as jest.Mocked<StreakService>;

  const results = {
    listByStudent: jest.fn().mockResolvedValue([]),
    findByStudentAndExercise: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<ExerciseResultRepository>;

  const exercises = {
    findByVersion: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<ExerciseRepository>;

  const progress = {
    isLessonCompleted: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<ProgressService>;

  const students = {
    findById: jest.fn().mockResolvedValue({ id: 'student-1', cohortId: null }),
  } as unknown as jest.Mocked<StudentRepository>;

  const enrollments = {
    listByStudent: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<EnrollmentRepository>;

  const prisma = {
    exercise: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as jest.Mocked<PrismaService>;

  const service = new BadgeService(
    badgeRepo, streakSvc, results, exercises, progress, students, enrollments, prisma,
  );
  return { service, badgeRepo, streakSvc, results, exercises, progress, students, enrollments, prisma };
}

describe('BadgeService.checkAndAward (system badges)', () => {
  it('awards first_submit on any submission', async () => {
    const { service, badgeRepo } = makeService();
    const awarded = await service.checkAndAward('student-1', makeCtx());
    expect(awarded.map((b) => b.code)).toContain('first_submit');
    expect(badgeRepo.award).toHaveBeenCalledWith('student-1', 'first_submit', null);
  });

  it('awards first_pass when passed and failedAttemptsBefore === 0', async () => {
    const { service } = makeService();
    const ctx = makeCtx({ attempt: makeAttempt({ passed: true, failedAttemptsBefore: 0 }) });
    const awarded = await service.checkAndAward('student-1', ctx);
    expect(awarded.map((b) => b.code)).toContain('first_pass');
  });

  it('does not award first_pass when student had prior failures', async () => {
    const { service } = makeService();
    const ctx = makeCtx({ attempt: makeAttempt({ passed: true, failedAttemptsBefore: 2 }) });
    const awarded = await service.checkAndAward('student-1', ctx);
    expect(awarded.map((b) => b.code)).not.toContain('first_pass');
  });

  it('awards streak_3 when current streak >= 3', async () => {
    const { service, streakSvc } = makeService();
    streakSvc.getCurrentStreak.mockResolvedValue({ current: 3, activeToday: true } as any);
    const awarded = await service.checkAndAward('student-1', makeCtx());
    expect(awarded.map((b) => b.code)).toContain('streak_3');
  });

  it('awards streak_7 when current streak >= 7', async () => {
    const { service, streakSvc } = makeService();
    streakSvc.getCurrentStreak.mockResolvedValue({ current: 7, activeToday: true } as any);
    const awarded = await service.checkAndAward('student-1', makeCtx());
    expect(awarded.map((b) => b.code)).toEqual(expect.arrayContaining(['streak_3', 'streak_7']));
  });

  it('awards all_types when all 5 exercise types have been passed', async () => {
    const { service, results, prisma } = makeService();
    const exIds = [newId(), newId(), newId(), newId(), newId()];
    const types: ExerciseType[] = ['code', 'fix_bug', 'fill_blank', 'predict_output', 'multiple_choice'];
    results.listByStudent.mockResolvedValue(
      exIds.map((id) => makeResult({ exerciseId: id, passed: true })),
    );
    (prisma.exercise.findMany as jest.Mock).mockResolvedValue(
      exIds.map((id, idx) => ({ id, version: 1, type: types[idx], lessonId: newId() })),
    );
    const awarded = await service.checkAndAward('student-1', makeCtx());
    expect(awarded.map((b) => b.code)).toContain('all_types');
  });

  it('awards points_100 when totalPoints >= 100', async () => {
    const { service } = makeService();
    const awarded = await service.checkAndAward('student-1', makeCtx({ totalPoints: 100 }));
    expect(awarded.map((b) => b.code)).toContain('points_100');
  });

  it('awards points_500 when totalPoints >= 500', async () => {
    const { service } = makeService();
    const awarded = await service.checkAndAward('student-1', makeCtx({ totalPoints: 500 }));
    expect(awarded.map((b) => b.code)).toEqual(expect.arrayContaining(['points_100', 'points_500']));
  });

  it('awards perfect_lesson when lesson is completed', async () => {
    const { service, progress } = makeService();
    progress.isLessonCompleted.mockResolvedValue(true);
    const awarded = await service.checkAndAward('student-1', makeCtx());
    expect(awarded.map((b) => b.code)).toContain('perfect_lesson');
  });

  it('does not re-award already-earned badges', async () => {
    const { service, badgeRepo } = makeService();
    badgeRepo.hasBadge.mockResolvedValue(true);
    const awarded = await service.checkAndAward('student-1', makeCtx({ totalPoints: 999 }));
    expect(awarded).toHaveLength(0);
    expect(badgeRepo.award).not.toHaveBeenCalled();
  });
});

describe('BadgeService.checkAndAward (instructor-defined criteria)', () => {
  it('awards points_threshold when totalPoints crosses configured threshold', async () => {
    const customBadge: Badge = {
      id: newId(),
      code: 'i_grinder',
      name: 'Grinder',
      description: 'Earn 250 points',
      icon: '💪',
      criteriaKind: 'points_threshold',
      thresholdValue: 250,
      scopeKind: 'public',
      scopeId: null,
      authorUserId: newId(),
      system: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service } = makeService([customBadge]);
    const awarded = await service.checkAndAward('s1', makeCtx({ totalPoints: 300 }));
    expect(awarded.map((b) => b.code)).toContain('i_grinder');
  });

  it('never auto-awards manual_award badges', async () => {
    const manual: Badge = {
      id: newId(),
      code: 'i_pat_on_back',
      name: 'Pat on the Back',
      description: 'Manual',
      icon: '👍',
      criteriaKind: 'manual_award',
      thresholdValue: null,
      scopeKind: 'public',
      scopeId: null,
      authorUserId: newId(),
      system: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { service } = makeService([manual]);
    const awarded = await service.checkAndAward('s1', makeCtx({ totalPoints: 99999 }));
    expect(awarded.map((b) => b.code)).not.toContain('i_pat_on_back');
  });
});

describe('BadgeService.listForStudent', () => {
  it('returns every visible badge with earned flag derived from StudentBadge rows', async () => {
    const { service, badgeRepo } = makeService();
    const earnedAt = new Date('2026-04-19T10:00:00Z');
    badgeRepo.findByStudent.mockResolvedValue([
      { id: newId(), studentId: 'student-list-test', badgeId: 'first_pass', earnedAt } as any,
    ]);
    const list = await service.listForStudent('student-list-test');
    expect(list.length).toBe(8);
    const firstPass = list.find((b) => b.code === 'first_pass');
    expect(firstPass?.earned).toBe(true);
    expect(firstPass?.earnedAt).toEqual(earnedAt);
    const others = list.filter((b) => b.code !== 'first_pass');
    expect(others.every((b) => b.earned === false)).toBe(true);
  });
});
