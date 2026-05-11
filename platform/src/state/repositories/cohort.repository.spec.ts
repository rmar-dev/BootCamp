import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CohortRepository } from './cohort.repository';

describe('CohortRepository', () => {
  let repo: CohortRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CohortRepository, PrismaService],
    }).compile();
    repo = moduleRef.get(CohortRepository);
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    // Relies on jest --runInBand (see package.json); any parallel worker would race on Student/Cohort rows.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Student", "Cohort" RESTART IDENTITY CASCADE');
  });

  it('returns cohort for a student when student.cohortId is set', async () => {
    const cohortId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    await prisma.cohort.create({
      data: {
        id: cohortId,
        name: 'Spring 2026',
        instructorId: crypto.randomUUID(),
        startDate: new Date(),
        cohortLength: 'twelve_week',
        exercisesPerLessonTarget: 10,
      },
    });
    await prisma.student.create({
      data: {
        id: studentId,
        name: 'Jane',
        email: 'jane@example.com',
        cohortId,
      },
    });

    const cohort = await repo.findByStudentId(studentId);

    expect(cohort).not.toBeNull();
    expect(cohort!.cohortLength).toBe('twelve_week');
    expect(cohort!.exercisesPerLessonTarget).toBe(10);
  });

  it('returns null when student has no cohort', async () => {
    const studentId = crypto.randomUUID();
    await prisma.student.create({
      data: { id: studentId, name: 'Bob', email: 'bob@example.com' },
    });

    const cohort = await repo.findByStudentId(studentId);
    expect(cohort).toBeNull();
  });

  it('returns null when the studentId does not exist at all', async () => {
    const cohort = await repo.findByStudentId(crypto.randomUUID());
    expect(cohort).toBeNull();
  });
});
