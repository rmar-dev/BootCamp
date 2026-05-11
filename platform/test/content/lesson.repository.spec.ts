import { PrismaClient } from '@prisma/client';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('LessonRepository', () => {
  let prisma: PrismaClient;
  let repo: LessonRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new LessonRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft lesson with one explanation block and one exercise block', async () => {
    const lessonId = newId();
    const trackId = newId();
    const exerciseId = newId();

    const lesson = await repo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'Variables',
      level: 'beginner',
      summary: 'Intro to variables',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'explanation',
          explanationMarkdown: 'A variable is...',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId,
          exerciseVersion: 1,
        },
      ],
    });

    expect(lesson.id).toBe(lessonId);
    expect(lesson.version).toBe(1);
    expect(lesson.blockIds).toHaveLength(2);

    const fetched = await repo.findByVersionWithBlocks(lessonId, 1);
    expect(fetched?.blocks).toHaveLength(2);
    expect(fetched?.blocks[0].kind).toBe('explanation');
    expect(fetched?.blocks[1].kind).toBe('exercise');
    expect(fetched?.blocks[1].exerciseId).toBe(exerciseId);
  });

  it('publishes a lesson', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      trackId: newId(),
      position: 0,
      title: 't',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    const published = await repo.publish(id, 1);
    expect(published.publishedAt).not.toBeNull();
  });

  it('finds the latest published version', async () => {
    const id = newId();
    const trackId = newId();
    await repo.createDraft({
      id,
      trackId,
      position: 0,
      title: 'v1',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    await repo.publish(id, 1);

    await repo.createNextVersion(id, {
      trackId,
      position: 0,
      title: 'v2',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    await repo.publish(id, 2);

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(2);
    expect(latest?.title).toBe('v2');
  });
});
