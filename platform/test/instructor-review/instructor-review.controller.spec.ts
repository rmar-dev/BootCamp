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

describe('InstructorReviewController (e2e)', () => {
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

  /**
   * Seed a user with the requested role and return cookie + userId.
   * The seeded login JWT already carries the role, so no re-login is needed.
   */
  async function registerAndGetCookie(
    email?: string,
    role: 'student' | 'instructor' = 'student',
  ): Promise<{ cookie: string; userId: string }> {
    const { cookie, userId } = await createUserAndLogin(app, prisma, { email, role });
    return { cookie, userId };
  }

  /**
   * Creates a Cohort linked to the given instructor, plus a Student in that cohort.
   */
  async function seedCohortAndStudent(
    instructorId: string,
  ): Promise<{ cohortId: string; studentId: string }> {
    const cohortId = newId();
    await prisma.cohort.create({
      data: {
        id: cohortId,
        name: 'Test Cohort',
        instructorId,
        startDate: new Date(),
      },
    });

    const studentId = newId();
    await prisma.student.create({
      data: {
        id: studentId,
        name: 'Student One',
        email: `student-${newId()}@test.com`,
        cohortId,
      },
    });

    return { cohortId, studentId };
  }

  /**
   * Creates an Exercise (type: code), a Lesson with a Block referencing the exercise,
   * a passing Attempt, and an ExerciseResult with bestAttemptId set.
   */
  async function seedExerciseAndPassingAttempt(studentId: string): Promise<{
    exerciseId: string;
    lessonId: string;
    blockId: string;
    attemptId: string;
    exerciseResultId: string;
  }> {
    const exerciseId = newId();
    await prisma.exercise.create({
      data: {
        id: exerciseId,
        version: 1,
        lessonId: newId(),
        promptMarkdown: '## Write a hello world function',
        type: 'code',
        payload: {
          type: 'code',
          language: 'swift',
          starterCode: 'func hello() -> String { return "" }',
          testCode: 'assert(hello() == "hello")',
          testEntryPoint: 'runTests',
        },
        pointsMax: 100,
        hints: [],
        concepts: [],
        publishedAt: new Date(),
      },
    });

    const lessonId = newId();
    const trackId = newId();
    await prisma.lesson.create({
      data: {
        id: lessonId,
        version: 1,
        trackId,
        position: 0,
        title: 'Swift Basics',
        level: 'beginner',
        summary: 'Introduction to Swift',
        blockIds: [],
        publishedAt: new Date(),
      },
    });

    const blockId = newId();
    await prisma.block.create({
      data: {
        id: blockId,
        lessonId,
        lessonVersion: 1,
        position: 0,
        kind: 'exercise',
        exerciseId,
        exerciseVersion: 1,
      },
    });

    // Update lesson blockIds
    await prisma.lesson.update({
      where: { id_version: { id: lessonId, version: 1 } },
      data: { blockIds: [blockId] },
    });

    const attemptId = newId();
    await prisma.attempt.create({
      data: {
        id: attemptId,
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submittedAt: new Date(),
        submissionPayload: {
          type: 'code',
          code: 'func hello() -> String { return "hello" }',
        },
        passed: true,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: 100,
      },
    });

    const exerciseResultId = newId();
    await prisma.exerciseResult.create({
      data: {
        id: exerciseResultId,
        studentId,
        exerciseId,
        bestAttemptId: attemptId,
        passed: true,
        pointsEarned: 100,
        attemptsCount: 1,
        firstPassedAt: new Date(),
      },
    });

    return { exerciseId, lessonId, blockId, attemptId, exerciseResultId };
  }

  // ─────────────────────────────────────────────
  // Queue tests
  // ─────────────────────────────────────────────

  describe('GET /api/instructor/queue', () => {
    it('returns pending items for instructor cohort', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      await seedExerciseAndPassingAttempt(studentId);

      const res = await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', cookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty('attemptId');
      expect(res.body[0]).toHaveProperty('studentName', 'Student One');
      expect(res.body[0]).toHaveProperty('exercisePrompt', '## Write a hello world function');
    });

    it('returns empty array when no students in cohort', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      // Create cohort with no students
      await prisma.cohort.create({
        data: {
          id: newId(),
          name: 'Empty Cohort',
          instructorId: userId,
          startDate: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns 403 for student role', async () => {
      const { cookie } = await registerAndGetCookie(undefined, 'student');

      await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', cookie)
        .expect(403);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // Attempt detail tests
  // ─────────────────────────────────────────────

  describe('GET /api/instructor/attempt/:attemptId', () => {
    it('returns code and exercise prompt for a valid attempt', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      const res = await request(app.getHttpServer())
        .get(`/api/instructor/attempt/${attemptId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.attemptId).toBe(attemptId);
      expect(res.body.code).toBe('func hello() -> String { return "hello" }');
      expect(res.body.exercisePrompt).toBe('## Write a hello world function');
      expect(res.body.language).toBe('swift');
      expect(res.body.passed).toBe(true);
    });

    it('returns 404 for a non-existent attempt', async () => {
      const { cookie } = await registerAndGetCookie(undefined, 'instructor');

      await request(app.getHttpServer())
        .get(`/api/instructor/attempt/${newId()}`)
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────
  // Create review tests
  // ─────────────────────────────────────────────

  describe('POST /api/instructor/review', () => {
    it('creates a review and returns it', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      const res = await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: '**Excellent work!** Clean Swift idioms.' })
        .expect(201);

      expect(res.body.attemptId).toBe(attemptId);
      expect(res.body.instructorId).toBe(userId);
      expect(res.body.markdown).toBe('**Excellent work!** Clean Swift idioms.');
      expect(res.body.id).toBeDefined();
    });

    it('returns 409 when a review already exists for the attempt', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      // First review
      await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'First review.' })
        .expect(201);

      // Duplicate
      await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'Duplicate review.' })
        .expect(409);
    });
  });

  // ─────────────────────────────────────────────
  // Edit review tests
  // ─────────────────────────────────────────────

  describe('PUT /api/instructor/review/:id', () => {
    it('updates the markdown of an existing review', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      const createRes = await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'Original markdown.' })
        .expect(201);

      const reviewId: string = createRes.body.id;

      const updateRes = await request(app.getHttpServer())
        .put(`/api/instructor/review/${reviewId}`)
        .set('Cookie', cookie)
        .send({ markdown: 'Updated markdown with better feedback.' })
        .expect(200);

      expect(updateRes.body.markdown).toBe('Updated markdown with better feedback.');
      expect(updateRes.body.id).toBe(reviewId);
    });
  });

  // ─────────────────────────────────────────────
  // Get review tests
  // ─────────────────────────────────────────────

  describe('GET /api/instructor/review/:attemptId', () => {
    it('returns review with messages for the instructor', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'Great job!' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/instructor/review/${attemptId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.attemptId).toBe(attemptId);
      expect(res.body.markdown).toBe('Great job!');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.createdAt).toBeDefined();
    });

    it('returns 404 when no review exists for the attempt', async () => {
      const { cookie } = await registerAndGetCookie(undefined, 'instructor');

      await request(app.getHttpServer())
        .get(`/api/instructor/review/${newId()}`)
        .set('Cookie', cookie)
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────
  // Thread message tests
  // ─────────────────────────────────────────────

  describe('POST /api/instructor/review/:id/messages', () => {
    it('adds a message to a review thread', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      const createRes = await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'Good work!' })
        .expect(201);

      const reviewId: string = createRes.body.id;

      const msgRes = await request(app.getHttpServer())
        .post(`/api/instructor/review/${reviewId}/messages`)
        .set('Cookie', cookie)
        .send({ body: 'Thank you for the feedback!' })
        .expect(201);

      expect(msgRes.body.instructorReviewId).toBe(reviewId);
      expect(msgRes.body.body).toBe('Thank you for the feedback!');
      expect(msgRes.body.authorId).toBe(userId);
      expect(msgRes.body.id).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // Queue state transition tests
  // ─────────────────────────────────────────────

  describe('Queue state transition', () => {
    it('moves item from pending queue to reviewed queue after creating a review', async () => {
      const { cookie, userId } = await registerAndGetCookie(undefined, 'instructor');
      const { studentId } = await seedCohortAndStudent(userId);
      const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

      // Initially item is in the pending queue
      const pendingBefore = await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', cookie)
        .expect(200);

      expect(pendingBefore.body.length).toBe(1);
      expect(pendingBefore.body[0].attemptId).toBe(attemptId);

      // Reviewed queue is empty
      const reviewedBefore = await request(app.getHttpServer())
        .get('/api/instructor/queue/reviewed')
        .set('Cookie', cookie)
        .expect(200);

      expect(reviewedBefore.body.length).toBe(0);

      // Create a review
      await request(app.getHttpServer())
        .post('/api/instructor/review')
        .set('Cookie', cookie)
        .send({ attemptId, markdown: 'Approved!' })
        .expect(201);

      // Pending queue is now empty
      const pendingAfter = await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', cookie)
        .expect(200);

      expect(pendingAfter.body.length).toBe(0);

      // Reviewed queue now has the item
      const reviewedAfter = await request(app.getHttpServer())
        .get('/api/instructor/queue/reviewed')
        .set('Cookie', cookie)
        .expect(200);

      expect(reviewedAfter.body.length).toBe(1);
      expect(reviewedAfter.body[0].attemptId).toBe(attemptId);
    });
  });
});
