import { PrismaClient } from '@prisma/client';
import { ProgressAggregatorService } from '../../src/progress/progress.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressAggregatorService — track progress', () => {
  let prisma: PrismaClient;
  let svc: ProgressAggregatorService;
  let tracks: TrackRepository;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let students: StudentRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    tracks = new TrackRepository(prisma as any);
    lessons = new LessonRepository(prisma as any);
    exercises = new ExerciseRepository(prisma as any);
    students = new StudentRepository(prisma as any);
    svc = new ProgressAggregatorService(prisma as any, tracks, students);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeExercise(concepts: string[] = []): Promise<string> {
    const id = newId();
    await exercises.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts,
    });
    await exercises.publish(id, 1);
    return id;
  }

  async function makeLessonWithExercises(
    trackId: string,
    position: number,
    exerciseIds: string[],
  ): Promise<{ lessonId: string; lessonVersion: number }> {
    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId,
      trackId,
      position,
      title: `Lesson ${position}`,
      level: 'beginner',
      summary: 's',
      blocks: exerciseIds.map((exerciseId, i) => ({
        id: newId(),
        position: i,
        kind: 'exercise' as const,
        exerciseId,
        exerciseVersion: 1,
      })),
    });
    await lessons.publish(lessonId, 1);
    return { lessonId, lessonVersion: 1 };
  }

  async function makeStudent(): Promise<string> {
    const s = await students.create({ id: newId(), name: 'S', email: `s-${newId()}@t.com` });
    return s.id;
  }

  async function seedAttemptAndResult(
    studentId: string,
    exerciseId: string,
    passed: boolean,
    submittedAt: Date = new Date(),
  ): Promise<void> {
    const attemptId = newId();
    await prisma.attempt.create({
      data: {
        id: attemptId,
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submittedAt,
        submissionPayload: {},
        passed,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: passed ? 10 : 0,
      },
    });
    if (passed) {
      await prisma.exerciseResult.create({
        data: {
          id: newId(),
          studentId,
          exerciseId,
          bestAttemptId: attemptId,
          passed: true,
          pointsEarned: 10,
          attemptsCount: 1,
          firstPassedAt: submittedAt,
        },
      });
    }
  }

  it('returns not_started for a lesson with no attempts', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result!.trackId).toBe(trackId);
    expect(result!.lessons).toHaveLength(1);
    expect(result!.lessons[0]).toMatchObject({
      lessonId, lessonVersion, totalExercises: 2, passedExercises: 0,
      attemptedExercises: 0, state: 'not_started', lastAttemptAt: null,
    });
  });

  it('returns in_progress when some but not all exercises passed', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const exC = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB, exC]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);
    const when = new Date('2026-04-20T10:00:00Z');
    await seedAttemptAndResult(studentId, exA, true, when);
    await seedAttemptAndResult(studentId, exB, false, new Date('2026-04-21T10:00:00Z'));

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result!.lessons[0]).toMatchObject({
      totalExercises: 3, passedExercises: 1, attemptedExercises: 2, state: 'in_progress',
    });
    expect(result!.lessons[0].lastAttemptAt).toBe('2026-04-21T10:00:00.000Z');
  });

  it('returns complete when every exercise passed', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);
    await seedAttemptAndResult(studentId, exA, true);
    await seedAttemptAndResult(studentId, exB, true);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result!.lessons[0].state).toBe('complete');
    expect(result!.lessons[0].passedExercises).toBe(2);
  });

  it('returns empty lessons array for a published track with no lessons', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result!.lessons).toEqual([]);
  });

  it('treats a lesson with no exercise blocks as not_started (totalExercises=0)', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, []);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result!.lessons[0]).toMatchObject({
      totalExercises: 0, passedExercises: 0, attemptedExercises: 0, state: 'not_started',
    });
  });

  it('returns null when the track does not exist', async () => {
    const studentId = await makeStudent();
    const result = await svc.getTrackProgress(studentId, newId());
    expect(result).toBeNull();
  });

  describe('concept progress', () => {
    it('returns empty concepts array when no exercises exist', async () => {
      const studentId = await makeStudent();
      const result = await svc.getConceptProgress(studentId);
      expect(result.concepts).toEqual([]);
    });

    it('counts total exercises per concept across all published exercises', async () => {
      const studentId = await makeStudent();
      await makeExercise(['functions', 'strings']);
      await makeExercise(['functions']);
      await makeExercise(['strings']);

      const result = await svc.getConceptProgress(studentId);

      const functions = result.concepts.find((c) => c.concept === 'functions')!;
      const strings = result.concepts.find((c) => c.concept === 'strings')!;
      expect(functions.totalExercises).toBe(2);
      expect(strings.totalExercises).toBe(2);
      expect(functions.passedExercises).toBe(0);
      expect(strings.passedExercises).toBe(0);
    });

    it('counts passed exercises per concept for the student', async () => {
      const studentId = await makeStudent();
      const exA = await makeExercise(['functions', 'strings']);
      const exB = await makeExercise(['functions']);
      await makeExercise(['strings']);
      await seedAttemptAndResult(studentId, exA, true);
      await seedAttemptAndResult(studentId, exB, true);

      const result = await svc.getConceptProgress(studentId);

      const functions = result.concepts.find((c) => c.concept === 'functions')!;
      const strings = result.concepts.find((c) => c.concept === 'strings')!;
      expect(functions).toMatchObject({ totalExercises: 2, passedExercises: 2 });
      expect(strings).toMatchObject({ totalExercises: 2, passedExercises: 1 });
    });

    it('sorts by passedExercises DESC, then concept ASC', async () => {
      const studentId = await makeStudent();
      const exA = await makeExercise(['zeta']);
      const exB = await makeExercise(['alpha']);
      await makeExercise(['beta']);
      await seedAttemptAndResult(studentId, exA, true);
      await seedAttemptAndResult(studentId, exB, true);

      const result = await svc.getConceptProgress(studentId);

      // alpha and zeta both have passedExercises=1; alpha first (ASC tiebreak).
      // beta has passedExercises=0 (last).
      expect(result.concepts.map((c) => c.concept)).toEqual(['alpha', 'zeta', 'beta']);
    });

    it('excludes exercises that are not published', async () => {
      const studentId = await makeStudent();
      const publishedId = newId();
      await exercises.createDraft({
        id: publishedId, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['visible'],
      });
      await exercises.publish(publishedId, 1);
      const draftId = newId();
      await exercises.createDraft({
        id: draftId, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['hidden'],
      });

      const result = await svc.getConceptProgress(studentId);
      expect(result.concepts.map((c) => c.concept)).toContain('visible');
      expect(result.concepts.map((c) => c.concept)).not.toContain('hidden');
    });

    it('collapses multiple versions of the same exercise to the latest', async () => {
      const studentId = await makeStudent();
      const exId = newId();
      await exercises.createDraft({
        id: exId, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['v1-only'],
      });
      await exercises.publish(exId, 1);
      await exercises.createNextVersion(exId, {
        lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['v2'],
      });
      await exercises.publish(exId, 2);

      const result = await svc.getConceptProgress(studentId);

      // Only v2 concepts should appear — v1-only was superseded
      expect(result.concepts.map((c) => c.concept)).toEqual(['v2']);
      expect(result.concepts.find((c) => c.concept === 'v2')!.totalExercises).toBe(1);
    });
  });
});
