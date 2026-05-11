import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LessonRepository } from '../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../src/content/repositories/exercise.repository';
import { resetDb } from './helpers/db';
import { newId } from '../src/shared/ids';

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

describe('LessonController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    lessonRepo = moduleFixture.get(LessonRepository);
    exerciseRepo = moduleFixture.get(ExerciseRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function getAuthCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `user-${newId()}@test.com`,
        name: 'Tester',
        password: 'password123',
      });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.find((c: string) => c.startsWith('bc.access='))!;
  }

  it('GET /api/lessons/:id returns published lesson', async () => {
    const cookie = await getAuthCookie();
    const exId = newId();
    const lessonId = newId();

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

    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'My Lesson',
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
    await lessonRepo.publish(lessonId, 1);

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.id).toBe(lessonId);
    expect(res.body.version).toBe(1);
    expect(res.body.blocks).toHaveLength(1);
    expect(res.body.blocks[0].kind).toBe('exercise');
    expect(res.body.blocks[0].exercise.type).toBe('multiple_choice');
  });

  it('GET /api/lessons/:id returns 404 when not published', async () => {
    const cookie = await getAuthCookie();
    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'Draft Only',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('GET /api/lessons/:id returns 404 when not found', async () => {
    const cookie = await getAuthCookie();

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${newId()}`)
      .set('Cookie', cookie)
      .expect(404);

    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('GET /api/lessons/:id returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get(`/api/lessons/${newId()}`)
      .expect(401);
  });

  it('GET /api/lessons/:id returns correct attemptStatus for first_try and eventual', async () => {
    // Register with a known email so we can look up the user later
    const knownEmail = `known-${newId()}@test.com`;
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: knownEmail, name: 'Student', password: 'password123' });
    const rawCookie = regRes.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(rawCookie) ? rawCookie : [rawCookie];
    const knownCookie = cookieArr.find((c: string) => c.startsWith('bc.access='))!;

    const ex1Id = newId();
    const ex2Id = newId();
    const lessonId = newId();
    const trackId = newId();

    // Seed two exercises
    await exerciseRepo.createDraft({
      id: ex1Id,
      lessonId,
      promptMarkdown: 'First exercise',
      type: 'multiple_choice',
      payload: mcPayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(ex1Id, 1);

    await exerciseRepo.createDraft({
      id: ex2Id,
      lessonId,
      promptMarkdown: 'Second exercise',
      type: 'multiple_choice',
      payload: mcPayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(ex2Id, 1);

    // Seed a lesson with two exercise blocks
    await lessonRepo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'Status Test Lesson',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: newId(), position: 0, kind: 'exercise', exerciseId: ex1Id, exerciseVersion: 1 },
        { id: newId(), position: 1, kind: 'exercise', exerciseId: ex2Id, exerciseVersion: 1 },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    // Trigger ensureStudent by hitting the lesson endpoint once
    await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', knownCookie)
      .expect(200);

    // Look up user and student rows
    const user = await prisma.user.findFirstOrThrow({ where: { email: knownEmail } });
    const student = await prisma.student.findFirstOrThrow({ where: { userId: user.id } });
    const studentId = student.id;

    const basePayload = { type: 'multiple_choice', selectedOptionIds: ['a'] } as Prisma.InputJsonValue;

    // ex1: one passing attempt (first try)
    await prisma.attempt.create({
      data: {
        id: newId(),
        studentId,
        exerciseId: ex1Id,
        exerciseVersion: 1,
        submittedAt: new Date('2026-01-01T10:00:00Z'),
        submissionPayload: basePayload,
        passed: true,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: 10,
      },
    });

    // ex2: one failed attempt, then one passing attempt
    await prisma.attempt.create({
      data: {
        id: newId(),
        studentId,
        exerciseId: ex2Id,
        exerciseVersion: 1,
        submittedAt: new Date('2026-01-01T10:01:00Z'),
        submissionPayload: basePayload,
        passed: false,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: 0,
      },
    });
    await prisma.attempt.create({
      data: {
        id: newId(),
        studentId,
        exerciseId: ex2Id,
        exerciseVersion: 1,
        submittedAt: new Date('2026-01-01T10:02:00Z'),
        submissionPayload: basePayload,
        passed: true,
        hintsUsedCount: 0,
        failedAttemptsBefore: 1,
        pointsAwarded: 7,
      },
    });

    // Now fetch the lesson — attempts should be reflected in attemptStatus
    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', knownCookie)
      .expect(200);

    const exerciseBlocks = res.body.blocks.filter((b: { kind: string }) => b.kind === 'exercise');
    expect(exerciseBlocks).toHaveLength(2);

    const block1 = exerciseBlocks.find((b: { exercise: { id: string } }) => b.exercise.id === ex1Id);
    const block2 = exerciseBlocks.find((b: { exercise: { id: string } }) => b.exercise.id === ex2Id);

    expect(block1).toBeDefined();
    expect(block2).toBeDefined();
    expect(block1.exercise.attemptStatus).toBe('first_try');
    expect(block2.exercise.attemptStatus).toBe('eventual');
  });

  it('GET /api/lessons/:id/v/:version returns specific version', async () => {
    const cookie = await getAuthCookie();
    const exId = newId();
    const lessonId = newId();

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

    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'My Lesson',
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
    await lessonRepo.publish(lessonId, 1);

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}/v/1`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.version).toBe(1);
    expect(res.body.blocks).toHaveLength(1);
    expect(res.body.blocks[0].kind).toBe('exercise');
    expect(res.body.blocks[0].exercise.type).toBe('multiple_choice');
  });
});
