import { PrismaClient } from '@prisma/client';
import { LessonAssemblerService } from '../../src/content/services/lesson-assembler.service';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ExamDifficultyOverrideRepository } from '../../src/state/repositories/exam-difficulty-override.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('LessonAssemblerService', () => {
  let prisma: PrismaClient;
  let svc: LessonAssemblerService;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;
  let examOverrides: ExamDifficultyOverrideRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    lessonRepo = new LessonRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    examOverrides = new ExamDifficultyOverrideRepository(prisma as any);
    svc = new LessonAssemblerService(lessonRepo, exerciseRepo, prisma as any, examOverrides);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns null for an unknown lesson id', async () => {
    const result = await svc.assembleLatest(newId());
    expect(result).toBeNull();
  });

  it('returns null when only a draft exists', async () => {
    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'Draft Lesson',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });

    const result = await svc.assembleLatest(lessonId);
    expect(result).toBeNull();
  });

  it('assembleLatest inlines exercise payloads', async () => {
    const exId = newId();
    const lessonId = newId();
    const trackId = newId();

    const mcPayload = {
      type: 'multiple_choice' as const,
      questionMarkdown: 'Which?',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctOptionIds: ['a'],
      multiSelect: false,
    };

    await exerciseRepo.createDraft({
      id: exId,
      lessonId,
      promptMarkdown: 'Choose wisely',
      type: 'multiple_choice',
      payload: mcPayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exId, 1);

    const explanationBlockId = newId();
    const exerciseBlockId = newId();

    await lessonRepo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'My Lesson',
      level: 'beginner',
      summary: 's',
      blocks: [
        {
          id: explanationBlockId,
          position: 0,
          kind: 'explanation',
          explanationMarkdown: '# Hi',
        },
        {
          id: exerciseBlockId,
          position: 1,
          kind: 'exercise',
          exerciseId: exId,
          exerciseVersion: 1,
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    const result = await svc.assembleLatest(lessonId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(lessonId);
    expect(result!.version).toBe(1);
    expect(result!.title).toBe('My Lesson');
    expect(result!.blocks).toHaveLength(2);

    const firstBlock = result!.blocks[0];
    expect(firstBlock.kind).toBe('explanation');
    if (firstBlock.kind === 'explanation') {
      expect(firstBlock.id).toBe(explanationBlockId);
      expect(firstBlock.markdown).toBe('# Hi');
    }

    const secondBlock = result!.blocks[1];
    expect(secondBlock.kind).toBe('exercise');
    if (secondBlock.kind === 'exercise') {
      expect(secondBlock.id).toBe(exerciseBlockId);
      expect(secondBlock.exercise.id).toBe(exId);
      expect(secondBlock.exercise.version).toBe(1);
      expect(secondBlock.exercise.type).toBe('multiple_choice');
      expect(secondBlock.exercise.payload).toMatchObject({
        type: 'multiple_choice',
        questionMarkdown: 'Which?',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      });
    }
  });

  it('emits a video block from DB rows with all video columns mapped', async () => {
    const lessonId = newId();
    const trackId = newId();
    const videoBlockId = newId();

    await lessonRepo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'Concept video lesson',
      level: 'intermediate',
      summary: 's',
      blocks: [
        {
          id: videoBlockId,
          position: 0,
          kind: 'video',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoTitle: 'What does @State do?',
          videoDescription: 'Local, mutable storage owned by a single view.',
          videoDurationLabel: '2 MIN',
          videoPosterUrl: 'https://img.example.com/poster.jpg',
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    const result = await svc.assembleLatest(lessonId);
    expect(result).not.toBeNull();
    expect(result!.blocks).toHaveLength(1);

    const block = result!.blocks[0];
    expect(block.kind).toBe('video');
    if (block.kind === 'video') {
      expect(block.id).toBe(videoBlockId);
      expect(block.video.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(block.video.title).toBe('What does @State do?');
      expect(block.video.description).toBe('Local, mutable storage owned by a single view.');
      expect(block.video.durationLabel).toBe('2 MIN');
      expect(block.video.posterUrl).toBe('https://img.example.com/poster.jpg');
    }
  });

  it('skips video blocks with no videoUrl rather than emitting an unrenderable block', async () => {
    const lessonId = newId();
    const trackId = newId();

    await lessonRepo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'Broken video lesson',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: newId(), position: 0, kind: 'video', videoUrl: null },
        { id: newId(), position: 1, kind: 'explanation', explanationMarkdown: 'fallback' },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    const result = await svc.assembleLatest(lessonId);
    expect(result!.blocks).toHaveLength(1);
    expect(result!.blocks[0].kind).toBe('explanation');
  });
});
