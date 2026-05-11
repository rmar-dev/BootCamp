// NOTE: Relies on --runInBand; no parallel workers are safe here because
// we TRUNCATE shared DB tables in beforeEach.

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { newId } from '../src/shared/ids';

// ---------------------------------------------------------------------------
// Shared MC payload used for all exercise fixtures
// ---------------------------------------------------------------------------
const MC_PAYLOAD = {
  type: 'multiple_choice' as const,
  questionMarkdown: 'Pick one',
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  correctOptionIds: ['a'],
  multiSelect: false,
};

// ---------------------------------------------------------------------------
// Helpers (all local to this file)
// ---------------------------------------------------------------------------

type StudentFixture = { studentId: string; cookie: string };

type LessonFixture = {
  lessonId: string;
  trackId: string;
  exerciseIds: string[];
};

async function createCohort(
  prisma: PrismaService,
  cohortLength: 'four_week' | 'twelve_week',
  exercisesPerLessonTarget: number,
): Promise<string> {
  const id = newId();
  await prisma.cohort.create({
    data: {
      id,
      name: `cohort-${id}`,
      instructorId: newId(),
      startDate: new Date(),
      cohortLength,
      exercisesPerLessonTarget,
    },
  });
  return id;
}

async function createStudent(
  app: INestApplication,
  prisma: PrismaService,
  cohortId: string | null,
): Promise<StudentFixture> {
  const email = `student-${newId()}@test.com`;
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, name: 'E2E Student', password: 'password123' });

  const raw = res.headers['set-cookie'] as string | string[];
  const arr = Array.isArray(raw) ? raw : [raw];
  const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found after registration');

  // Upsert a Student row linked to this User via userId (Student.id is a
  // separate UUID — the controllers now resolve User.id → Student.id via
  // EnsureStudentService before calling AssignmentService/CohortRepository).
  const existing = await prisma.student.findFirst({ where: { userId: user.id } });
  let studentId: string;
  if (existing) {
    await prisma.student.update({ where: { id: existing.id }, data: { cohortId } });
    studentId = existing.id;
  } else {
    const created = await prisma.student.create({
      data: {
        id: newId(),
        userId: user.id,
        name: user.name,
        email: user.email,
        cohortId,
      },
    });
    studentId = created.id;
  }

  // studentId is the real Student.id (distinct from User.id in production).
  return { studentId, cookie };
}

type CreateLessonOptions = {
  exerciseCount: number;
  cohortGate?: 'four_week' | 'twelve_week' | null;
  trackId?: string;
};

async function createLesson(
  prisma: PrismaService,
  opts: CreateLessonOptions,
): Promise<LessonFixture> {
  const lessonId = newId();
  const trackId = opts.trackId ?? newId();
  const exerciseIds: string[] = [];
  const blockIds: string[] = [];

  // Create all exercises first
  for (let i = 0; i < opts.exerciseCount; i++) {
    const exId = newId();
    exerciseIds.push(exId);
    await prisma.exercise.create({
      data: {
        id: exId,
        version: 1,
        lessonId,
        promptMarkdown: `Question ${i + 1}`,
        type: 'multiple_choice',
        payload: MC_PAYLOAD,
        pointsMax: 10,
        hints: [],
        concepts: [],
        publishedAt: new Date(),
        contentHash: `hash-${exId}`,
      },
    });
  }

  // Build block ids
  for (let i = 0; i < exerciseIds.length; i++) {
    blockIds.push(newId());
  }

  // Create the lesson
  await prisma.lesson.create({
    data: {
      id: lessonId,
      version: 1,
      trackId,
      position: 0,
      title: `Lesson ${lessonId}`,
      level: 'beginner',
      summary: 'summary',
      blockIds,
      publishedAt: new Date(),
      contentHash: `hash-${lessonId}`,
      cohortGate: opts.cohortGate ?? null,
    },
  });

  // Create blocks
  for (let i = 0; i < exerciseIds.length; i++) {
    await prisma.block.create({
      data: {
        id: blockIds[i],
        lessonId,
        lessonVersion: 1,
        position: i,
        kind: 'exercise',
        exerciseId: exerciseIds[i],
        exerciseVersion: 1,
      },
    });
  }

  return { lessonId, trackId, exerciseIds };
}

async function createAttempt(
  prisma: PrismaService,
  studentId: string,
  exerciseId: string,
): Promise<void> {
  await prisma.attempt.create({
    data: {
      id: newId(),
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { selectedOptionId: 'a' },
      passed: true,
      hintsUsedCount: 0,
      failedAttemptsBefore: 0,
      pointsAwarded: 10,
    },
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AdaptiveContentEngine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset in dependency order (state refs content, but no real FKs across
    // the half-boundary — reset content last).
    await prisma.reviewMessage.deleteMany();
    await prisma.instructorReview.deleteMany();
    await prisma.studentBadge.deleteMany();
    await prisma.codeReview.deleteMany();
    await prisma.attempt.deleteMany();
    await prisma.exerciseResult.deleteMany();
    await prisma.lessonAssignment.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany();
    await prisma.cohort.deleteMany();
    await prisma.block.deleteMany();
    await prisma.exercise.deleteMany();
    await prisma.lesson.deleteMany();
    await prisma.track.deleteMany();
  });

  // -------------------------------------------------------------------------
  // Test 1: four_week student gets 4 exercises from 8-pool lesson
  // -------------------------------------------------------------------------
  it('four_week student GET /api/lessons/:id returns 4 exercises from 8-pool lesson', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { studentId, cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId } = await createLesson(prisma, { exerciseCount: 8 });

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    const exerciseBlocks = res.body.blocks.filter((b: any) => b.kind === 'exercise');
    expect(exerciseBlocks).toHaveLength(4);

    expect(res.body.assignment).not.toBeNull();
    expect(res.body.assignment.status).toBe('active');
    expect(res.body.assignment.selectedExerciseIds).toHaveLength(4);

    // studentId is used internally; suppress unused-variable warning
    void studentId;
  });

  // -------------------------------------------------------------------------
  // Test 2: Repeated GET returns the same assignment
  // -------------------------------------------------------------------------
  it('repeated GET /api/lessons/:id returns the same assignment id', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId } = await createLesson(prisma, { exerciseCount: 8 });

    const res1 = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    const res2 = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res1.body.assignment.id).toBe(res2.body.assignment.id);
  });

  // -------------------------------------------------------------------------
  // Test 3: POST /revisit after attempts returns new assignment with unseen exercises
  // -------------------------------------------------------------------------
  it('POST /api/lessons/:id/revisit after attempts returns new assignment with unseen exercises', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { studentId, cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId, exerciseIds } = await createLesson(prisma, { exerciseCount: 8 });

    // Get initial assignment
    const res1 = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    const firstAssignmentId: string = res1.body.assignment.id;
    const firstSelectedIds: string[] = res1.body.assignment.selectedExerciseIds;

    // Create attempts for all 4 selected exercises
    for (const exId of firstSelectedIds) {
      await createAttempt(prisma, studentId, exId);
    }

    // Revisit — NestJS @Post defaults to 201
    const res2 = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/revisit`)
      .set('Cookie', cookie)
      .expect(201);

    expect(res2.body.assignment.id).not.toBe(firstAssignmentId);
    expect(res2.body.assignment.status).toBe('active');

    // No overlap with previous selected IDs
    const newSelectedIds: string[] = res2.body.assignment.selectedExerciseIds;
    const overlap = newSelectedIds.filter((id) => firstSelectedIds.includes(id));
    expect(overlap).toHaveLength(0);

    // suppress unused warning
    void exerciseIds;
  });

  // -------------------------------------------------------------------------
  // Test 4: POST /revisit returns 409 when pool is exhausted
  // -------------------------------------------------------------------------
  it('POST /api/lessons/:id/revisit returns 409 when pool is exhausted', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { studentId, cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId, exerciseIds } = await createLesson(prisma, { exerciseCount: 8 });

    // First GET creates the initial active assignment
    await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    // Attempt all 8 pool exercises — pool is now fully seen
    for (const exId of exerciseIds) {
      await createAttempt(prisma, studentId, exId);
    }

    // Revisit should 409 because no unseen exercises remain
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/revisit`)
      .set('Cookie', cookie)
      .expect(409);

    expect(res.body.error).toBe('pool_complete');
  });

  // -------------------------------------------------------------------------
  // Test 5: GET /pool-status returns correct counts
  // -------------------------------------------------------------------------
  it('GET /api/lessons/:id/pool-status returns correct counts after 2 attempts', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { studentId, cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId, exerciseIds } = await createLesson(prisma, { exerciseCount: 8 });

    // Get lesson first to create the assignment
    await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    // Attempt 2 exercises
    await createAttempt(prisma, studentId, exerciseIds[0]);
    await createAttempt(prisma, studentId, exerciseIds[1]);

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}/pool-status`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.poolSize).toBe(8);
    expect(res.body.seenCount).toBe(2);
    expect(res.body.currentAssignmentIds).toHaveLength(4);
    expect(res.body.poolComplete).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test 6: twelve_week cohort gets 10 exercises from a 12-pool lesson
  // -------------------------------------------------------------------------
  it('twelve_week cohort sees 10 exercises from a 12-pool lesson', async () => {
    const cohortId = await createCohort(prisma, 'twelve_week', 10);
    const { cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId } = await createLesson(prisma, { exerciseCount: 12 });

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}`)
      .set('Cookie', cookie)
      .expect(200);

    const exerciseBlocks = res.body.blocks.filter((b: any) => b.kind === 'exercise');
    expect(exerciseBlocks).toHaveLength(10);
    expect(res.body.assignment.status).toBe('active');
    expect(res.body.assignment.selectedExerciseIds).toHaveLength(10);
  });

  // -------------------------------------------------------------------------
  // Test 7: ?mode=preview returns full pool regardless of cohort or attempts
  // -------------------------------------------------------------------------
  it('GET /api/lessons/:id?mode=preview returns full pool and null assignment', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { studentId, cookie } = await createStudent(app, prisma, cohortId);
    const { lessonId, exerciseIds } = await createLesson(prisma, { exerciseCount: 8 });

    // Create some attempts to confirm they don't filter in preview
    await createAttempt(prisma, studentId, exerciseIds[0]);
    await createAttempt(prisma, studentId, exerciseIds[1]);

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}?mode=preview`)
      .set('Cookie', cookie)
      .expect(200);

    const exerciseBlocks = res.body.blocks.filter((b: any) => b.kind === 'exercise');
    expect(exerciseBlocks).toHaveLength(8);
    expect(res.body.assignment).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 8: GET /api/tracks/:id hides twelve_week-gated lessons from four_week cohort
  // -------------------------------------------------------------------------
  it('GET /api/tracks/:id hides twelve_week-gated lessons from four_week cohort', async () => {
    const cohortId = await createCohort(prisma, 'four_week', 4);
    const { cookie } = await createStudent(app, prisma, cohortId);

    const trackId = newId();
    const openLessonId = newId();
    const gatedLessonId = newId();

    // Create both lessons
    await prisma.lesson.create({
      data: {
        id: openLessonId,
        version: 1,
        trackId,
        position: 0,
        title: 'Open Lesson',
        level: 'beginner',
        summary: 'no gate',
        blockIds: [],
        publishedAt: new Date(),
        contentHash: `hash-${openLessonId}`,
        cohortGate: null,
      },
    });
    await prisma.lesson.create({
      data: {
        id: gatedLessonId,
        version: 1,
        trackId,
        position: 1,
        title: 'Gated Lesson',
        level: 'advanced',
        summary: 'twelve_week only',
        blockIds: [],
        publishedAt: new Date(),
        contentHash: `hash-${gatedLessonId}`,
        cohortGate: 'twelve_week',
      },
    });

    // Create and publish the track referencing both lessons
    await prisma.track.create({
      data: {
        id: trackId,
        version: 1,
        title: 'Test Track',
        language: 'swift',
        kind: 'fundamentals',
        description: 'desc',
        lessonIds: [openLessonId, gatedLessonId],
        lessonVersions: [1, 1],
        publishedAt: new Date(),
        contentHash: `hash-${trackId}`,
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/tracks/${trackId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.lessons).toHaveLength(1);
    expect(res.body.lessons[0].id).toBe(openLessonId);
    expect(res.body.lessonCount).toBe(1);
  });
});
