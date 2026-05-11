import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(): Promise<{ cookie: string; userId: string; studentId: string }> {
    const userEmail = `user-${newId()}@test.com`;
    const password = 'password123';
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, name: 'Tester', password });
    const userId: string = regRes.body.user.id;
    const raw = regRes.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;

    // Create the Student record linked to this user
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Tester', email: `student-${newId()}@test.com`, userId },
    });

    return { cookie, userId, studentId };
  }

  async function seedTrackWithOneLesson(): Promise<{ trackId: string; lessonId: string; exerciseId: string }> {
    const exerciseId = newId();
    await prisma.exercise.create({
      data: {
        id: exerciseId, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    const lessonId = newId();
    const trackId = newId();
    await prisma.lesson.create({
      data: {
        id: lessonId, version: 1, trackId, position: 0, title: 'L',
        level: 'beginner', summary: 's', blockIds: [], publishedAt: new Date(),
      },
    });
    await prisma.block.create({
      data: {
        id: newId(), lessonId, lessonVersion: 1, position: 0,
        kind: 'exercise', exerciseId, exerciseVersion: 1,
      },
    });
    await prisma.track.create({
      data: {
        id: trackId, version: 1, title: 'T', language: 'swift', kind: 'fundamentals',
        description: 'd', lessonIds: [lessonId], lessonVersions: [1], publishedAt: new Date(),
      },
    });
    return { trackId, lessonId, exerciseId };
  }

  describe('GET /api/progress/tracks/:trackId', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/api/progress/tracks/${newId()}`)
        .expect(401);
    });

    it('returns 404 for a non-existent track', async () => {
      const { cookie } = await registerAndGetCookie();
      await request(app.getHttpServer())
        .get(`/api/progress/tracks/${newId()}`)
        .set('Cookie', cookie)
        .expect(404);
    });

    it('returns lesson progress with correct states for mixed attempts', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const { trackId, lessonId, exerciseId } = await seedTrackWithOneLesson();

      // Seed a passing attempt + result
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId, exerciseVersion: 1,
          submittedAt: new Date('2026-04-22T12:00:00Z'),
          submissionPayload: {}, passed: true, hintsUsedCount: 0,
          failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.trackId).toBe(trackId);
      expect(res.body.lessons).toHaveLength(1);
      expect(res.body.lessons[0]).toMatchObject({
        lessonId, lessonVersion: 1, totalExercises: 1,
        passedExercises: 1, attemptedExercises: 1, state: 'complete',
      });
      expect(res.body.lessons[0].lastAttemptAt).toBe('2026-04-22T12:00:00.000Z');
    });

    it('returns all not_started lessons for a student with no attempts', async () => {
      const { cookie } = await registerAndGetCookie();
      const { trackId } = await seedTrackWithOneLesson();

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.lessons[0].state).toBe('not_started');
      expect(res.body.lessons[0].passedExercises).toBe(0);
    });

    it('returns empty lessons when caller has no Student record', async () => {
      // Register a user but do NOT create a Student linked to them
      const userEmail = `user-${newId()}@test.com`;
      const regRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: userEmail, name: 'Tester', password: 'password123' });
      const raw = regRes.headers['set-cookie'] as string | string[];
      const arr = Array.isArray(raw) ? raw : [raw];
      const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;

      const { trackId } = await seedTrackWithOneLesson();

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      // No student => treat as zero attempts for every lesson
      expect(res.body.lessons).toHaveLength(1);
      expect(res.body.lessons[0].state).toBe('not_started');
    });
  });

  describe('GET /api/progress/concepts', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/progress/concepts')
        .expect(401);
    });

    it('returns counts across all published exercises', async () => {
      const { cookie, studentId } = await registerAndGetCookie();

      const exA = newId();
      await prisma.exercise.create({
        data: {
          id: exA, version: 1, lessonId: newId(), promptMarkdown: 'p',
          type: 'multiple_choice',
          payload: { type: 'multiple_choice', questionMarkdown: 'q',
            options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
            correctOptionIds: ['a'], multiSelect: false },
          pointsMax: 10, hints: [], concepts: ['functions', 'strings'], publishedAt: new Date(),
        },
      });
      const exB = newId();
      await prisma.exercise.create({
        data: {
          id: exB, version: 1, lessonId: newId(), promptMarkdown: 'p',
          type: 'multiple_choice',
          payload: { type: 'multiple_choice', questionMarkdown: 'q',
            options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
            correctOptionIds: ['a'], multiSelect: false },
          pointsMax: 10, hints: [], concepts: ['functions'], publishedAt: new Date(),
        },
      });

      // Pass exA only
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: new Date(), submissionPayload: {}, passed: true,
          hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: exA, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/progress/concepts')
        .set('Cookie', cookie)
        .expect(200);

      const byConcept = Object.fromEntries(
        res.body.concepts.map((c: any) => [c.concept, c]),
      );
      expect(byConcept.functions).toMatchObject({ totalExercises: 2, passedExercises: 1 });
      expect(byConcept.strings).toMatchObject({ totalExercises: 1, passedExercises: 1 });
    });

    it('returns 0/N for a student with no attempts', async () => {
      const { cookie } = await registerAndGetCookie();
      await prisma.exercise.create({
        data: {
          id: newId(), version: 1, lessonId: newId(), promptMarkdown: 'p',
          type: 'multiple_choice',
          payload: { type: 'multiple_choice', questionMarkdown: 'q',
            options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
            correctOptionIds: ['a'], multiSelect: false },
          pointsMax: 10, hints: [], concepts: ['untouched'], publishedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/progress/concepts')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.concepts).toEqual([
        { concept: 'untouched', totalExercises: 1, passedExercises: 0 },
      ]);
    });
  });
});
