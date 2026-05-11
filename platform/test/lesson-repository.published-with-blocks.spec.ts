import { PrismaClient } from '@prisma/client';
import { LessonRepository } from '../src/content/repositories/lesson.repository';
import { makeTestPrisma, resetDb } from './helpers/db';
import { newId } from '../src/shared/ids';

let repo: LessonRepository;
let prisma: PrismaClient;

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

describe('LessonRepository.findLatestPublishedWithBlocks', () => {
  it('returns null when no published version exists', async () => {
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
    expect(await repo.findLatestPublishedWithBlocks(id)).toBeNull();
  });

  it('returns the latest published version with blocks ordered by position', async () => {
    const id = newId();
    const blockA = newId();
    const blockB = newId();
    await repo.createDraft({
      id,
      trackId: newId(),
      position: 0,
      title: 't',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: blockA, position: 1, kind: 'explanation', explanationMarkdown: 'A' },
        { id: blockB, position: 0, kind: 'explanation', explanationMarkdown: 'B' },
      ],
    });
    await repo.publish(id, 1);

    const result = await repo.findLatestPublishedWithBlocks(id);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.blocks.map((b) => b.explanationMarkdown)).toEqual(['B', 'A']);
  });
});

describe('LessonRepository.findPublishedByVersionWithBlocks', () => {
  it('returns null for a draft version', async () => {
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
    expect(await repo.findPublishedByVersionWithBlocks(id, 1)).toBeNull();
  });

  it('returns the lesson with blocks when that version is published', async () => {
    const id = newId();
    const blockId = newId();
    await repo.createDraft({
      id,
      trackId: newId(),
      position: 0,
      title: 't',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: blockId, position: 0, kind: 'explanation', explanationMarkdown: 'Hello' },
      ],
    });
    await repo.publish(id, 1);

    const result = await repo.findPublishedByVersionWithBlocks(id, 1);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.blocks).toHaveLength(1);
  });

  it('returns null when the requested version does not exist', async () => {
    const result = await repo.findPublishedByVersionWithBlocks(newId(), 1);
    expect(result).toBeNull();
  });
});
