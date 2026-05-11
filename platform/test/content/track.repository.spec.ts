import { PrismaClient } from '@prisma/client';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('TrackRepository', () => {
  let prisma: PrismaClient;
  let repo: TrackRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new TrackRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft track with version 1', async () => {
    const id = newId();
    const created = await repo.createDraft({
      id,
      title: 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'Learn Swift basics',
      lessons: [],
    });
    expect(created.id).toBe(id);
    expect(created.version).toBe(1);
    expect(created.publishedAt).toBeNull();
  });

  it('publishes a track by setting publishedAt', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'Kotlin Fundamentals',
      language: 'kotlin',
      kind: 'fundamentals',
      description: 'Learn Kotlin basics',
      lessons: [],
    });
    const published = await repo.publish(id, 1);
    expect(published.publishedAt).not.toBeNull();
  });

  it('finds the latest published version', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'Swift v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);

    await repo.createNextVersion(id, {
      title: 'Swift v2',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 2);

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(2);
    expect(latest?.title).toBe('Swift v2');
  });

  it('does not return unpublished versions from findLatestPublished', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);
    await repo.createNextVersion(id, {
      title: 'v2 draft',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(1);
  });

  it('finds a specific version', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);
    await repo.createNextVersion(id, {
      title: 'v2',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    const v1 = await repo.findByVersion(id, 1);
    expect(v1?.title).toBe('v1');
    const v2 = await repo.findByVersion(id, 2);
    expect(v2?.title).toBe('v2');
  });
});
