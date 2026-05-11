import { ReviewRepository } from '../../src/review/review.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { newId } from '../../src/shared/ids';

describe('ReviewRepository', () => {
  let prisma: PrismaClient;
  let repo: ReviewRepository;

  beforeAll(async () => {
    prisma = makeTestPrisma();
    repo = new ReviewRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('creates a review and retrieves it by attemptId', async () => {
    const attemptId = newId();
    const studentId = newId();

    const created = await repo.create({
      attemptId,
      studentId,
      markdown: '**Review**: Good use of Swift generics!',
    });

    expect(created.attemptId).toBe(attemptId);
    expect(created.studentId).toBe(studentId);
    expect(created.markdown).toBe('**Review**: Good use of Swift generics!');

    const found = await repo.findByAttemptId(attemptId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('returns null for unknown attemptId', async () => {
    const result = await repo.findByAttemptId(newId());
    expect(result).toBeNull();
  });
});
