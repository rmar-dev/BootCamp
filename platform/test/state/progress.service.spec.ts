import { PrismaClient } from '@prisma/client';
import { ProgressService } from '../../src/state/services/progress.service';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressService', () => {
  let prisma: PrismaClient;
  let svc: ProgressService;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;
  let resultRepo: ExerciseResultRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    lessonRepo = new LessonRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    resultRepo = new ExerciseResultRepository(prisma as any);
    const trackRepo = new TrackRepository(prisma as any);
    svc = new ProgressService(lessonRepo, resultRepo, trackRepo);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeLessonWithTwoExercises(): Promise<{
    lessonId: string;
    lessonVersion: number;
    exerciseIds: [string, string];
  }> {
    const exA = newId();
    const exB = newId();
    await exerciseRepo.createDraft({
      id: exA,
      lessonId: newId(),
      promptMarkdown: 'a',
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
    await exerciseRepo.publish(exA, 1);
    await exerciseRepo.createDraft({
      id: exB,
      lessonId: newId(),
      promptMarkdown: 'b',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exB, 1);

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
          exerciseId: exA,
          exerciseVersion: 1,
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exB,
          exerciseVersion: 1,
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    return { lessonId, lessonVersion: 1, exerciseIds: [exA, exB] };
  }

  it('reports a lesson as not completed when no exercises are passed', async () => {
    const { lessonId, lessonVersion } = await makeLessonWithTwoExercises();
    const studentId = newId();
    const completed = await svc.isLessonCompleted(
      studentId,
      lessonId,
      lessonVersion,
    );
    expect(completed).toBe(false);
  });

  it('reports a lesson as not completed when only one of two exercises is passed', async () => {
    const { lessonId, lessonVersion, exerciseIds } =
      await makeLessonWithTwoExercises();
    const studentId = newId();
    await resultRepo.upsert({
      id: newId(),
      studentId,
      exerciseId: exerciseIds[0],
      bestAttemptId: newId(),
      passed: true,
      pointsEarned: 10,
      attemptsCount: 1,
      firstPassedAt: new Date(),
    });
    const completed = await svc.isLessonCompleted(
      studentId,
      lessonId,
      lessonVersion,
    );
    expect(completed).toBe(false);
  });

  it('reports a lesson as completed when all exercises are passed', async () => {
    const { lessonId, lessonVersion, exerciseIds } =
      await makeLessonWithTwoExercises();
    const studentId = newId();
    for (const exId of exerciseIds) {
      await resultRepo.upsert({
        id: newId(),
        studentId,
        exerciseId: exId,
        bestAttemptId: newId(),
        passed: true,
        pointsEarned: 10,
        attemptsCount: 1,
        firstPassedAt: new Date(),
      });
    }
    const completed = await svc.isLessonCompleted(
      studentId,
      lessonId,
      lessonVersion,
    );
    expect(completed).toBe(true);
  });

  it('ignores explanation blocks when computing lesson completion', async () => {
    const exA = newId();
    await exerciseRepo.createDraft({
      id: exA,
      lessonId: newId(),
      promptMarkdown: 'a',
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
    await exerciseRepo.publish(exA, 1);

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
          kind: 'explanation',
          explanationMarkdown: 'read this',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exA,
          exerciseVersion: 1,
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    const studentId = newId();
    await resultRepo.upsert({
      id: newId(),
      studentId,
      exerciseId: exA,
      bestAttemptId: newId(),
      passed: true,
      pointsEarned: 10,
      attemptsCount: 1,
      firstPassedAt: new Date(),
    });

    const completed = await svc.isLessonCompleted(studentId, lessonId, 1);
    expect(completed).toBe(true);
  });
});
