import { PrismaClient } from '@prisma/client';
import { InstructorContentService } from '../../src/instructor-content/instructor-content.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { PublishService } from '../../src/content/services/publish.service';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('InstructorContentService', () => {
  let prisma: PrismaClient;
  let svc: InstructorContentService;
  let trackRepo: TrackRepository;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;
  let publisher: PublishService;

  beforeAll(() => {
    prisma = makeTestPrisma();
    trackRepo = new TrackRepository(prisma as never);
    lessonRepo = new LessonRepository(prisma as never);
    exerciseRepo = new ExerciseRepository(prisma as never);
    publisher = new PublishService(trackRepo, lessonRepo, exerciseRepo);
    svc = new InstructorContentService(
      lessonRepo,
      exerciseRepo,
      trackRepo,
      publisher,
      prisma as never,
    );
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Re-usable fixture: a published track with no lessons. createLesson() will
  // append onto it; updateLesson() targets a lesson already on it.
  async function seedTrack(): Promise<{ trackId: string }> {
    const trackId = newId();
    await trackRepo.createDraft({
      id: trackId,
      title: 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'desc',
      lessons: [],
    });
    await trackRepo.publish(trackId, 1);
    return { trackId };
  }

  describe('createLesson (POST)', () => {
    it('creates a new lesson + exercise and bumps the track to a new version that includes it', async () => {
      const { trackId } = await seedTrack();

      const result = await svc.createLesson({
        trackId,
        title: 'Optionals',
        level: 'beginner',
        summary: 'Why ? matters',
        publish: true,
        blocks: [
          { kind: 'explanation', markdown: '## Optionals' },
          {
            kind: 'exercise',
            promptMarkdown: 'Pick one',
            type: 'multiple_choice',
            payload: {
              type: 'multiple_choice',
              questionMarkdown: 'Pick one',
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
          },
        ],
      });

      // Lesson row exists, version 1, published.
      const lesson = await lessonRepo.findByVersion(result.lessonId, result.lessonVersion);
      expect(lesson?.title).toBe('Optionals');
      expect(lesson?.publishedAt).not.toBeNull();

      // Track was bumped to v2 and now includes the new lesson.
      expect(result.trackVersion).toBe(2);
      const newTrack = await trackRepo.findByVersion(trackId, 2);
      expect(newTrack?.lessonIds).toEqual([result.lessonId]);
      expect(newTrack?.lessonVersions).toEqual([result.lessonVersion]);
      expect(newTrack?.publishedAt).not.toBeNull();

      // Exercise was created at v1 and published.
      expect(result.exercises).toHaveLength(1);
      const ex = await exerciseRepo.findByVersion(
        result.exercises[0].id,
        result.exercises[0].version,
      );
      expect(ex?.publishedAt).not.toBeNull();
    });

    it('publish: false leaves the chain unpublished', async () => {
      const { trackId } = await seedTrack();
      const result = await svc.createLesson({
        trackId,
        title: 'Draft only',
        level: 'beginner',
        summary: '',
        publish: false,
        blocks: [{ kind: 'explanation', markdown: 'hi' }],
      });
      const lesson = await lessonRepo.findByVersion(result.lessonId, result.lessonVersion);
      expect(lesson?.publishedAt).toBeNull();
      const track = await trackRepo.findByVersion(trackId, result.trackVersion);
      expect(track?.publishedAt).toBeNull();
    });

    it('rejects an invalid exercise payload before writing anything', async () => {
      const { trackId } = await seedTrack();
      await expect(
        svc.createLesson({
          trackId,
          title: 'Bad',
          level: 'beginner',
          summary: '',
          blocks: [
            {
              kind: 'exercise',
              promptMarkdown: '',
              type: 'multiple_choice',
              // Missing required questionMarkdown — Zod validator should reject.
              payload: { type: 'multiple_choice', options: [], correctOptionIds: [], multiSelect: false } as never,
              pointsMax: 10,
              hints: [],
              concepts: [],
            },
          ],
        }),
      ).rejects.toThrow(/Block 1/);

      // No lesson should have been written.
      const all = await prisma.lesson.findMany();
      expect(all).toHaveLength(0);
    });
  });

  describe('updateLesson (PUT)', () => {
    it('creates lesson v2 + exercise v2 and bumps the track so students see the new chain', async () => {
      const { trackId } = await seedTrack();

      // Seed via createLesson so we have a v1 to update.
      const created = await svc.createLesson({
        trackId,
        title: 'V1 title',
        level: 'beginner',
        summary: 's',
        publish: true,
        blocks: [
          {
            kind: 'exercise',
            promptMarkdown: 'V1 prompt',
            type: 'multiple_choice',
            payload: {
              type: 'multiple_choice',
              questionMarkdown: 'V1?',
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
          },
        ],
      });

      // Update path — pass existingExerciseId so the same exercise gets a v2.
      const updated = await svc.updateLesson(created.lessonId, {
        trackId,
        title: 'V2 title',
        level: 'intermediate',
        summary: 's',
        publish: true,
        blocks: [
          {
            kind: 'exercise',
            existingExerciseId: created.exercises[0].id,
            promptMarkdown: 'V2 prompt',
            type: 'multiple_choice',
            payload: {
              type: 'multiple_choice',
              questionMarkdown: 'V2?',
              options: [
                { id: 'a', text: 'Better A' },
                { id: 'b', text: 'B' },
              ],
              correctOptionIds: ['a'],
              multiSelect: false,
            },
            pointsMax: 20,
            hints: [],
            concepts: [],
          },
        ],
      });

      expect(updated.lessonId).toBe(created.lessonId);
      expect(updated.lessonVersion).toBe(2);

      const v2 = await lessonRepo.findByVersion(updated.lessonId, 2);
      expect(v2?.title).toBe('V2 title');
      expect(v2?.publishedAt).not.toBeNull();

      // Track v3 (v1 seed + v2 from createLesson + v3 from updateLesson) now
      // points the same lesson id at version 2.
      expect(updated.trackVersion).toBe(3);
      const trackV3 = await trackRepo.findByVersion(trackId, 3);
      expect(trackV3?.lessonIds).toEqual([created.lessonId]);
      expect(trackV3?.lessonVersions).toEqual([2]);

      // Exercise v2 exists, same id, new version.
      expect(updated.exercises[0].id).toBe(created.exercises[0].id);
      expect(updated.exercises[0].version).toBe(2);
      const exV2 = await exerciseRepo.findByVersion(updated.exercises[0].id, 2);
      expect(exV2?.promptMarkdown).toBe('V2 prompt');
      expect(exV2?.publishedAt).not.toBeNull();

      // V1 of both lesson and exercise is preserved (immutable history).
      const v1Lesson = await lessonRepo.findByVersion(created.lessonId, 1);
      expect(v1Lesson?.title).toBe('V1 title');
      const v1Ex = await exerciseRepo.findByVersion(created.exercises[0].id, 1);
      expect(v1Ex?.promptMarkdown).toBe('V1 prompt');
    });

    it('throws NotFound when the lesson id does not exist', async () => {
      const { trackId } = await seedTrack();
      await expect(
        svc.updateLesson(newId(), {
          trackId,
          title: 't',
          level: 'beginner',
          summary: '',
          blocks: [{ kind: 'explanation', markdown: 'x' }],
        }),
      ).rejects.toThrow(/not found/i);
    });
  });
});
