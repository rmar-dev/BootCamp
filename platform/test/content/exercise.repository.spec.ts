import { PrismaClient } from '@prisma/client';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ExerciseRepository', () => {
  let prisma: PrismaClient;
  let repo: ExerciseRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new ExerciseRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft code exercise with valid payload', async () => {
    const id = newId();
    const created = await repo.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'Write a function that returns 1.',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func answer() -> Int { return 0 }',
        testCode: 'assert(answer() == 1)',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: ['Try returning 1.'],
      concepts: ['functions'],
    });
    expect(created.id).toBe(id);
    expect(created.version).toBe(1);
  });

  it('rejects creation with an invalid payload for the declared type', async () => {
    await expect(
      repo.createDraft({
        id: newId(),
        lessonId: newId(),
        promptMarkdown: 'q',
        type: 'code',
        payload: {
          type: 'multiple_choice',
          questionMarkdown: 'wrong shape',
          options: [],
          correctOptionIds: [],
          multiSelect: false,
        } as any,
        pointsMax: 100,
        hints: [],
        concepts: [],
      }),
    ).rejects.toThrow();
  });

  it('publishes and finds latest published', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'q',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 50,
      hints: [],
      concepts: [],
    });
    await repo.publish(id, 1);
    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(1);
  });
});
