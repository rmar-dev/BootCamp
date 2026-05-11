// test/gamification/profile.service.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { ProfileService } from '../../src/gamification/profile.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProfileService.composeProfile', () => {
  let app: INestApplication;
  let svc: ProfileService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
    svc = m.get(ProfileService);
    prisma = m.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('returns full ProfileResponse for an active student', async () => {
    const userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        email: 'p@test.com',
        name: 'P Tester',
        role: 'student',
      },
    });
    const studentId = newId();
    await prisma.student.create({
      data: {
        id: studentId,
        userId,
        name: 'P Tester',
        email: 'p@test.com',
      },
    });

    // Seed an attempt today so the heat strip's last cell is non-zero.
    await prisma.attempt.create({
      data: {
        id: newId(),
        studentId,
        exerciseId: newId(),
        exerciseVersion: 1,
        submittedAt: new Date(),
        submissionPayload: {} as any,
        passed: true,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: 50,
      },
    });

    const profile = await svc.composeProfile(studentId);

    expect(profile.account.studentId).toBe(studentId);
    expect(profile.account.name).toBe('P Tester');
    expect(profile.account.email).toBe('p@test.com');
    expect(profile.account.level).toBeGreaterThanOrEqual(1);
    expect(profile.heatStrip).toHaveLength(182);
    expect(profile.heatStrip[181]).toBeGreaterThan(0); // today, after the attempt
    expect(profile.kpis.totalPoints).toBe(0); // no ExerciseResult row was inserted (only Attempt)
    expect(profile.kpis.currentStreak).toBeGreaterThanOrEqual(0);
    expect(profile.kpis.badgesTotal).toBeGreaterThan(0);
    expect(Array.isArray(profile.skills)).toBe(true);
    expect(Array.isArray(profile.badges)).toBe(true);
    expect(Array.isArray(profile.trackBadges)).toBe(true);
  });

  it('returns empty heat strip and zero KPIs for a brand-new student', async () => {
    const userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        email: 'n@test.com',
        name: 'New',
        role: 'student',
      },
    });
    const studentId = newId();
    await prisma.student.create({
      data: {
        id: studentId,
        userId,
        name: 'New',
        email: 'n@test.com',
      },
    });

    const profile = await svc.composeProfile(studentId);
    expect(profile.heatStrip.every((v) => v === 0)).toBe(true);
    expect(profile.kpis.totalPoints).toBe(0);
    expect(profile.kpis.currentStreak).toBe(0);
    expect(profile.kpis.badgesEarned).toBe(0);
    expect(profile.skills).toEqual([]);
    expect(profile.account.level).toBe(1); // brand-new = level 1
  });

  it('throws NotFoundException when student does not exist', async () => {
    await expect(svc.composeProfile(newId())).rejects.toThrow(
      /student not found/,
    );
  });
});
