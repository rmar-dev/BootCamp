import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { LessonAssignmentRepository } from './lesson-assignment.repository';

describe('LessonAssignmentRepository', () => {
  let repo: LessonAssignmentRepository;
  let prisma: PrismaService;
  const studentId = crypto.randomUUID();
  const lessonId = crypto.randomUUID();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LessonAssignmentRepository, PrismaService],
    }).compile();
    repo = moduleRef.get(LessonAssignmentRepository);
    prisma = moduleRef.get(PrismaService);
    // Relies on jest --runInBand (see package.json); any parallel worker would race.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "LessonAssignment" RESTART IDENTITY CASCADE');
  });

  it('creates an active assignment', async () => {
    const ex1 = crypto.randomUUID();
    const ex2 = crypto.randomUUID();
    const a = await repo.create({
      studentId,
      lessonId,
      lessonVersion: 1,
      selectedExerciseIds: [ex1, ex2],
    });
    expect(a.completedAt).toBeNull();
    expect(a.selectedExerciseIds).toEqual([ex1, ex2]);
  });

  it('findActive returns the open assignment for (student, lesson)', async () => {
    await repo.create({ studentId, lessonId, lessonVersion: 1, selectedExerciseIds: [] });
    const active = await repo.findActive(studentId, lessonId);
    expect(active).not.toBeNull();
    expect(active!.completedAt).toBeNull();
  });

  it('findActive returns null when only completed assignments exist', async () => {
    const a = await repo.create({ studentId, lessonId, lessonVersion: 1, selectedExerciseIds: [] });
    await repo.markCompleted(a.id);
    const active = await repo.findActive(studentId, lessonId);
    expect(active).toBeNull();
  });

  it('markCompleted sets completedAt and leaves row otherwise intact', async () => {
    const a = await repo.create({ studentId, lessonId, lessonVersion: 1, selectedExerciseIds: [] });
    const updated = await repo.markCompleted(a.id);
    expect(updated.completedAt).not.toBeNull();
    expect(updated.id).toBe(a.id);
  });
});
