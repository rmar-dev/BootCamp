import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService, PoolCompleteException } from './assignment.service';
import { CohortRepository } from '../repositories/cohort.repository';
import { LessonAssignmentRepository } from '../repositories/lesson-assignment.repository';

describe('AssignmentService — first visit selection', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();
  const lessonVersion = 1;
  const poolExerciseIds = Array.from({ length: 8 }, () => crypto.randomUUID());

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AssignmentService,
        PrismaService,
        CohortRepository,
        LessonAssignmentRepository,
      ],
    }).compile();
    service = moduleRef.get(AssignmentService);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment", "Attempt", "Student", "Cohort" RESTART IDENTITY CASCADE');
    await prisma.cohort.create({
      data: {
        id: cohortId,
        name: 'c',
        instructorId: crypto.randomUUID(),
        startDate: new Date(),
        cohortLength: 'four_week',
        exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({
      data: { id: studentId, name: 'n', email: 'a@b', cohortId },
    });
  });

  it('selects first N unseen exercises from pool on first visit', async () => {
    const result = await service.resolve({
      studentId,
      lessonId,
      lessonVersion,
      poolExerciseIds,
    });
    expect(result.status).toBe('active');
    if (result.status !== 'active') return;
    expect(result.selectedExerciseIds).toEqual(poolExerciseIds.slice(0, 4));
  });

  it('persists the assignment on first visit', async () => {
    await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    const saved = await prisma.lessonAssignment.findMany({ where: { studentId, lessonId } });
    expect(saved).toHaveLength(1);
    expect(saved[0].selectedExerciseIds).toEqual(poolExerciseIds.slice(0, 4));
  });

  it('uses cohort.exercisesPerLessonTarget as N', async () => {
    await prisma.cohort.update({
      where: { id: cohortId },
      data: { cohortLength: 'twelve_week', exercisesPerLessonTarget: 6 },
    });
    const result = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    expect(result.status).toBe('active');
    if (result.status !== 'active') return;
    expect(result.selectedExerciseIds).toHaveLength(6);
  });

  it('capstone pool of 1 returns active with the single exercise even when target is 4', async () => {
    const capstonePool = [crypto.randomUUID()];
    const result = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds: capstonePool });
    expect(result.status).toBe('active');
    if (result.status !== 'active') return;
    expect(result.selectedExerciseIds).toEqual(capstonePool);
  });
});

describe('AssignmentService — session stability', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();
  const lessonVersion = 1;
  const poolExerciseIds = Array.from({ length: 8 }, () => crypto.randomUUID());

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AssignmentService, PrismaService, CohortRepository, LessonAssignmentRepository],
    }).compile();
    service = moduleRef.get(AssignmentService);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment", "Attempt", "Student", "Cohort" RESTART IDENTITY CASCADE');
    await prisma.cohort.create({
      data: {
        id: cohortId, name: 'c', instructorId: crypto.randomUUID(),
        startDate: new Date(), cohortLength: 'four_week', exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({ data: { id: studentId, name: 'n', email: 's@b', cohortId } });
  });

  it('repeated resolve() returns the same active assignment', async () => {
    const first = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    const second = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    expect(first.status).toBe('active');
    expect(second.status).toBe('active');
    if (first.status !== 'active' || second.status !== 'active') return;
    expect(second.assignmentId).toBe(first.assignmentId);
    expect(second.selectedExerciseIds).toEqual(first.selectedExerciseIds);
  });

  it('resolve does not drop an exercise that was passed mid-session', async () => {
    const resolved = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    if (resolved.status !== 'active') throw new Error('expected active');
    const passedId = resolved.selectedExerciseIds[0];
    await prisma.attempt.create({
      data: {
        id: crypto.randomUUID(), studentId, exerciseId: passedId, exerciseVersion: 1,
        submissionPayload: {}, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100,
      },
    });
    const after = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    if (after.status !== 'active') throw new Error('expected active');
    expect(after.selectedExerciseIds).toContain(passedId);
  });
});

describe('AssignmentService — revisit', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();
  const lessonVersion = 1;
  const poolExerciseIds = Array.from({ length: 8 }, () => crypto.randomUUID());

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AssignmentService, PrismaService, CohortRepository, LessonAssignmentRepository],
    }).compile();
    service = moduleRef.get(AssignmentService);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment", "Attempt", "Student", "Cohort" RESTART IDENTITY CASCADE');
    await prisma.cohort.create({
      data: {
        id: cohortId, name: 'c', instructorId: crypto.randomUUID(),
        startDate: new Date(), cohortLength: 'four_week', exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({ data: { id: studentId, name: 'n', email: 'r@b', cohortId } });
  });

  it('revisit closes the active assignment and creates a new one with unseen exercises', async () => {
    const first = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    if (first.status !== 'active') throw new Error('expected active');
    for (const id of first.selectedExerciseIds) {
      await prisma.attempt.create({
        data: {
          id: crypto.randomUUID(), studentId, exerciseId: id, exerciseVersion: 1,
          submissionPayload: {}, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100,
        },
      });
    }

    const second = await service.revisit({ studentId, lessonId, lessonVersion, poolExerciseIds });
    if (second.status !== 'active') throw new Error('expected active');
    expect(second.assignmentId).not.toBe(first.assignmentId);
    for (const id of first.selectedExerciseIds) {
      expect(second.selectedExerciseIds).not.toContain(id);
    }

    const prior = await prisma.lessonAssignment.findUnique({ where: { id: first.assignmentId } });
    expect(prior?.completedAt).not.toBeNull();
  });

  it('revisit throws PoolCompleteException when no unseen exercises remain', async () => {
    for (const id of poolExerciseIds) {
      await prisma.attempt.create({
        data: {
          id: crypto.randomUUID(), studentId, exerciseId: id, exerciseVersion: 1,
          submissionPayload: {}, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100,
        },
      });
    }

    await expect(
      service.revisit({ studentId, lessonId, lessonVersion, poolExerciseIds }),
    ).rejects.toBeInstanceOf(PoolCompleteException);
  });
});

describe('AssignmentService — pool-complete on first visit', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();
  const lessonVersion = 1;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AssignmentService, PrismaService, CohortRepository, LessonAssignmentRepository],
    }).compile();
    service = moduleRef.get(AssignmentService);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment", "Attempt", "Student", "Cohort" RESTART IDENTITY CASCADE');
    await prisma.cohort.create({
      data: {
        id: cohortId, name: 'c', instructorId: crypto.randomUUID(),
        startDate: new Date(), cohortLength: 'four_week', exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({ data: { id: studentId, name: 'n', email: 'p@b', cohortId } });
  });

  it('returns pool_complete when |unseen| < targetCount and no active assignment exists', async () => {
    const poolExerciseIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    for (const id of poolExerciseIds.slice(0, 2)) {
      await prisma.attempt.create({
        data: {
          id: crypto.randomUUID(), studentId, exerciseId: id, exerciseVersion: 1,
          submissionPayload: {}, passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });
    }

    const result = await service.resolve({ studentId, lessonId, lessonVersion, poolExerciseIds });
    expect(result.status).toBe('pool_complete');
    if (result.status !== 'pool_complete') return;
    expect(result.allExerciseIds).toEqual(poolExerciseIds);
  });
});

describe('AssignmentService — pool status', () => {
  let service: AssignmentService;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();
  const poolExerciseIds = Array.from({ length: 6 }, () => crypto.randomUUID());

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AssignmentService, PrismaService, CohortRepository, LessonAssignmentRepository],
    }).compile();
    service = moduleRef.get(AssignmentService);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment", "Attempt", "Student", "Cohort" RESTART IDENTITY CASCADE');
    await prisma.cohort.create({
      data: {
        id: cohortId, name: 'c', instructorId: crypto.randomUUID(),
        startDate: new Date(), cohortLength: 'four_week', exercisesPerLessonTarget: 4,
      },
    });
    await prisma.student.create({ data: { id: studentId, name: 'n', email: 'ps@b', cohortId } });
  });

  it('returns poolSize, seenCount, currentAssignmentIds, poolComplete', async () => {
    await service.resolve({ studentId, lessonId, lessonVersion: 1, poolExerciseIds });
    await prisma.attempt.create({
      data: {
        id: crypto.randomUUID(), studentId, exerciseId: poolExerciseIds[0], exerciseVersion: 1,
        submissionPayload: {}, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100,
      },
    });

    const status = await service.poolStatus(studentId, lessonId, poolExerciseIds);
    expect(status.poolSize).toBe(6);
    expect(status.seenCount).toBe(1);
    expect(status.currentAssignmentIds).toHaveLength(4);
    expect(status.poolComplete).toBe(false);
  });

  it('poolComplete true when all exercises attempted', async () => {
    for (const id of poolExerciseIds) {
      await prisma.attempt.create({
        data: {
          id: crypto.randomUUID(), studentId, exerciseId: id, exerciseVersion: 1,
          submissionPayload: {}, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100,
        },
      });
    }
    const status = await service.poolStatus(studentId, lessonId, poolExerciseIds);
    expect(status.poolComplete).toBe(true);
    expect(status.seenCount).toBe(6);
  });
});
