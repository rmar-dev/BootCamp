import { BadgeRepository } from '../../src/gamification/badge.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { newId } from '../../src/shared/ids';

describe('BadgeRepository', () => {
  let prisma: PrismaClient;
  let repo: BadgeRepository;
  let studentId: string;

  beforeAll(async () => {
    prisma = makeTestPrisma();
    repo = new BadgeRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    // Create a student to satisfy any FK constraints (studentId is just Uuid, no FK in schema)
    studentId = newId();
    await prisma.student.create({
      data: {
        id: studentId,
        name: 'Test Student',
        email: `test-${studentId}@test.com`,
      },
    });
  });

  it('should award a badge and find it for a student', async () => {
    const badge = await repo.award(studentId, 'first_submit');
    expect(badge.studentId).toBe(studentId);
    expect(badge.badgeId).toBe('first_submit');

    const badges = await repo.findByStudent(studentId);
    expect(badges).toHaveLength(1);
    expect(badges[0].badgeId).toBe('first_submit');
  });

  it('should return true from hasBadge when the badge exists', async () => {
    await repo.award(studentId, 'first_pass');
    const has = await repo.hasBadge(studentId, 'first_pass');
    expect(has).toBe(true);

    const hasNot = await repo.hasBadge(studentId, 'streak_3');
    expect(hasNot).toBe(false);
  });

  it('should be idempotent — awarding the same badge twice does not error or duplicate', async () => {
    const first = await repo.award(studentId, 'points_100');
    const second = await repo.award(studentId, 'points_100');
    expect(first.id).toBe(second.id);

    const badges = await repo.findByStudent(studentId);
    expect(badges).toHaveLength(1);
  });
});
