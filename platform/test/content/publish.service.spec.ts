import { PrismaClient } from '@prisma/client';
import { PublishService } from '../../src/content/services/publish.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('PublishService', () => {
  let prisma: PrismaClient;
  let svc: PublishService;
  let trackRepo: TrackRepository;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    trackRepo = new TrackRepository(prisma as any);
    lessonRepo = new LessonRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    svc = new PublishService(trackRepo, lessonRepo, exerciseRepo);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('publishes a track, its lessons, and its exercises', async () => {
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
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
      pointsMax: 10,
      hints: [],
      concepts: [],
    });

    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'L',
      level: 'beginner',
      summary: 's',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'exercise',
          exerciseId: exId,
          exerciseVersion: 1,
        },
      ],
    });

    const trackId = newId();
    await trackRepo.createDraft({
      id: trackId,
      title: 'T',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [{ id: lessonId, version: 1 }],
    });

    await svc.publishTrack(trackId, 1);

    const track = await trackRepo.findByVersion(trackId, 1);
    expect(track?.publishedAt).not.toBeNull();
    const lesson = await lessonRepo.findByVersion(lessonId, 1);
    expect(lesson?.publishedAt).not.toBeNull();
    const exercise = await exerciseRepo.findByVersion(exId, 1);
    expect(exercise?.publishedAt).not.toBeNull();
  });
});
