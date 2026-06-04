import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';
import { createUserAndLogin } from '../helpers/auth';

describe('ProgressController — GET /api/progress/recommendation (e2e)', () => {
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

  async function registerAndGetCookie(): Promise<{ cookie: string; userId: string; studentId: string | null }> {
    const { cookie, userId } = await createUserAndLogin(app, prisma);
    return { cookie, userId, studentId: null };
  }

  async function createStudent(userId: string): Promise<string> {
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Tester', email: `student-${newId()}@test.com`, userId },
    });
    return studentId;
  }

  async function seedOneLessonOneTrack(): Promise<{ trackId: string; lessonId: string; exerciseId: string }> {
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
        id: lessonId, version: 1, trackId, position: 0, title: 'Opener',
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
        id: trackId, version: 1, title: 'Swift Fundamentals', language: 'swift', kind: 'fundamentals',
        description: 'd', lessonIds: [lessonId], lessonVersions: [1], publishedAt: new Date(),
      },
    });
    return { trackId, lessonId, exerciseId };
  }

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .expect(401);
  });

  it('returns first_timer "Start here." when authenticated user has no Student row but tracks exist', async () => {
    const { cookie } = await registerAndGetCookie();
    const { lessonId, trackId } = await seedOneLessonOneTrack();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('first_timer');
    expect(res.body.reason.message).toBe('Start here.');
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.lesson.trackId).toBe(trackId);
    expect(res.body.lesson.trackTitle).toBe('Swift Fundamentals');
  });

  it('returns continue for a student with an in-progress lesson', async () => {
    const { cookie, userId } = await registerAndGetCookie();
    const studentId = await createStudent(userId);
    const { lessonId, exerciseId } = await seedOneLessonOneTrack();

    // Attach a second exercise to the lesson so partial progress is possible
    const ex2 = newId();
    await prisma.exercise.create({
      data: {
        id: ex2, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    await prisma.block.create({
      data: {
        id: newId(), lessonId, lessonVersion: 1, position: 1,
        kind: 'exercise', exerciseId: ex2, exerciseVersion: 1,
      },
    });

    // Pass exerciseId only
    const aid = newId();
    await prisma.attempt.create({
      data: {
        id: aid, studentId, exerciseId, exerciseVersion: 1,
        submittedAt: new Date(), submissionPayload: {},
        passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
      },
    });
    await prisma.exerciseResult.create({
      data: {
        id: newId(), studentId, exerciseId, bestAttemptId: aid,
        passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('continue');
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.reason.message).toBe('Continue where you left off.');
  });

  it('returns exhausted "No curriculum published yet." for an empty catalog', async () => {
    const { cookie } = await registerAndGetCookie();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toEqual({
      kind: 'exhausted',
      reason: { message: 'No curriculum published yet.' },
    });
  });

  it('accepts trackId query parameter and filters recommendation by track', async () => {
    const { cookie } = await registerAndGetCookie();
    const { trackId, lessonId } = await seedOneLessonOneTrack();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .query({ trackId })
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('first_timer');
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.lesson.trackId).toBe(trackId);
  });

  it('returns recommendation without trackId when query parameter is absent', async () => {
    const { cookie } = await registerAndGetCookie();
    const { trackId, lessonId } = await seedOneLessonOneTrack();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('first_timer');
    expect(res.body.lesson.id).toBe(lessonId);
  });
});
