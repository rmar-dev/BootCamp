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

describe('Capstone Submission & Approval (e2e)', () => {
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
  async function registerAndGetCookie(opts?: {
    email?: string;
    role?: 'student' | 'instructor';
  }): Promise<{ cookie: string; userId: string }> {
    const { cookie, userId } = await createUserAndLogin(app, prisma, {
      email: opts?.email,
      role: opts?.role ?? 'student',
    });
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
   * Creates a capstone_submission Exercise with a Lesson and Block.
   * Returns exerciseId and lessonId.
   */
  async function seedCapstoneExercise(
    studentId: string,
  ): Promise<{ exerciseId: string; lessonId: string }> {
    const exerciseId = newId();
    const lessonId = newId();
    const trackId = newId();
    const blockId = newId();

    await prisma.exercise.create({
      data: {
        id: exerciseId,
        version: 1,
        lessonId: lessonId,
        promptMarkdown: '## Submit your capstone project',
        type: 'capstone_submission',
        payload: { type: 'capstone_submission' },
        pointsMax: 500,
        hints: [],
        concepts: [],
        publishedAt: new Date(),
      },
    });

    await prisma.lesson.create({
      data: {
        id: lessonId,
        version: 1,
        trackId,
        position: 0,
        title: 'Capstone Project',
        level: 'beginner',
        summary: 'Submit your capstone project',
        blockIds: [blockId],
        publishedAt: new Date(),
      },
    });

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

    return { exerciseId, lessonId };
  }

  // ─────────────────────────────────────────────
  // Submission tests
  // ─────────────────────────────────────────────

  describe('POST /api/submit (capstone_submission)', () => {
    it('creates a pending Attempt with passed=false and approvedByInstructorId=null', async () => {
      const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
      const { studentId } = await seedCohortAndStudent(userId);
      const { exerciseId } = await seedCapstoneExercise(studentId);

      // Link the registered user to a student record so the submission service can find it
      const { cookie: studentCookie } = await registerAndGetCookie({ role: 'student' });

      const res = await request(app.getHttpServer())
        .post('/api/submit')
        .set('Cookie', studentCookie)
        .send({
          exerciseId,
          exerciseVersion: 1,
          repoUrl: 'https://github.com/test/repo',
          commitSha: 'abc1234f',
          notes: 'Build passes',
        })
        .expect(200);

      expect(res.body.passed).toBe(false);
      expect(res.body.attemptId).toBeDefined();

      // Verify in DB
      const attempt = await prisma.attempt.findUnique({
        where: { id: res.body.attemptId },
      });
      expect(attempt).not.toBeNull();
      expect(attempt!.passed).toBe(false);
      expect(attempt!.approvedByInstructorId).toBeNull();
    });

    it('rejects when repoUrl is missing', async () => {
      const { cookie: instructorCookie, userId } = await registerAndGetCookie({ role: 'instructor' });
      const { studentId } = await seedCohortAndStudent(userId);
      const { exerciseId } = await seedCapstoneExercise(studentId);

      const { cookie: studentCookie } = await registerAndGetCookie({ role: 'student' });

      const res = await request(app.getHttpServer())
        .post('/api/submit')
        .set('Cookie', studentCookie)
        .send({
          exerciseId,
          exerciseVersion: 1,
          commitSha: 'abc1234f',
          notes: 'Build passes',
          // repoUrl intentionally omitted
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─────────────────────────────────────────────
  // Approval tests
  // ─────────────────────────────────────────────

  describe('PUT /api/instructor/approve/:attemptId', () => {
    it('approves attempt: sets passed=true, awards points, creates ExerciseResult', async () => {
      const { cookie: instructorCookie, userId: instructorId } = await registerAndGetCookie({ role: 'instructor' });
      const { studentId } = await seedCohortAndStudent(instructorId);
      const { exerciseId } = await seedCapstoneExercise(studentId);

      // Submit as a student user
      const { cookie: studentCookie } = await registerAndGetCookie({ role: 'student' });

      const submitRes = await request(app.getHttpServer())
        .post('/api/submit')
        .set('Cookie', studentCookie)
        .send({
          exerciseId,
          exerciseVersion: 1,
          repoUrl: 'https://github.com/test/repo',
          commitSha: 'abc1234f',
          notes: 'Build passes',
        })
        .expect(200);

      const attemptId: string = submitRes.body.attemptId;

      // Now create a student record for studentId and link the attempt to it
      // The submission created a new student via ensureStudent; we need an attempt
      // belonging to an actual student in the instructor's cohort for the approval to work.
      // Instead, seed an attempt directly for the cohort student.
      const directAttemptId = newId();
      await prisma.attempt.create({
        data: {
          id: directAttemptId,
          studentId,
          exerciseId,
          exerciseVersion: 1,
          submittedAt: new Date(),
          submissionPayload: {
            type: 'capstone_submission',
            repoUrl: 'https://github.com/test/repo',
            commitSha: 'abc1234f',
            notes: 'Build passes',
          },
          passed: false,
          hintsUsedCount: 0,
          failedAttemptsBefore: 0,
          pointsAwarded: 0,
        },
      });

      const approveRes = await request(app.getHttpServer())
        .put(`/api/instructor/approve/${directAttemptId}`)
        .set('Cookie', instructorCookie)
        .expect(200);

      expect(approveRes.body.attempt.passed).toBe(true);
      expect(approveRes.body.attempt.approvedByInstructorId).toBe(instructorId);
      expect(approveRes.body.attempt.pointsAwarded).toBeGreaterThan(0);
      expect(approveRes.body.exerciseResult).toBeDefined();
      expect(approveRes.body.exerciseResult.passed).toBe(true);

      // Verify ExerciseResult in DB
      const result = await prisma.exerciseResult.findFirst({
        where: { studentId, exerciseId },
      });
      expect(result).not.toBeNull();
      expect(result!.passed).toBe(true);
    });

    it('returns 404 for a non-existent attempt', async () => {
      const { cookie: instructorCookie } = await registerAndGetCookie({ role: 'instructor' });

      await request(app.getHttpServer())
        .put(`/api/instructor/approve/${newId()}`)
        .set('Cookie', instructorCookie)
        .expect(404);
    });

    it('returns 409 for an already-approved attempt', async () => {
      const { cookie: instructorCookie, userId: instructorId } = await registerAndGetCookie({ role: 'instructor' });
      const { studentId } = await seedCohortAndStudent(instructorId);
      const { exerciseId } = await seedCapstoneExercise(studentId);

      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId,
          studentId,
          exerciseId,
          exerciseVersion: 1,
          submittedAt: new Date(),
          submissionPayload: {
            type: 'capstone_submission',
            repoUrl: 'https://github.com/test/repo',
            commitSha: 'abc1234f',
            notes: 'Build passes',
          },
          passed: false,
          hintsUsedCount: 0,
          failedAttemptsBefore: 0,
          pointsAwarded: 0,
        },
      });

      // First approval
      await request(app.getHttpServer())
        .put(`/api/instructor/approve/${attemptId}`)
        .set('Cookie', instructorCookie)
        .expect(200);

      // Second approval should be 409
      await request(app.getHttpServer())
        .put(`/api/instructor/approve/${attemptId}`)
        .set('Cookie', instructorCookie)
        .expect(409);
    });

    it('returns 403 for student role', async () => {
      const { cookie: studentCookie } = await registerAndGetCookie({ role: 'student' });

      await request(app.getHttpServer())
        .put(`/api/instructor/approve/${newId()}`)
        .set('Cookie', studentCookie)
        .expect(403);
    });
  });

  // ─────────────────────────────────────────────
  // Queue tests
  // ─────────────────────────────────────────────

  describe('GET /api/instructor/queue', () => {
    it('includes pending capstone submissions with queueType capstone_approval', async () => {
      const { cookie: instructorCookie, userId: instructorId } = await registerAndGetCookie({ role: 'instructor' });
      const { studentId } = await seedCohortAndStudent(instructorId);
      const { exerciseId } = await seedCapstoneExercise(studentId);

      // Seed a pending capstone attempt for the cohort student
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId,
          studentId,
          exerciseId,
          exerciseVersion: 1,
          submittedAt: new Date(),
          submissionPayload: {
            type: 'capstone_submission',
            repoUrl: 'https://github.com/test/repo',
            commitSha: 'abc1234f',
            notes: 'Build passes',
          },
          passed: false,
          hintsUsedCount: 0,
          failedAttemptsBefore: 0,
          pointsAwarded: 0,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/instructor/queue')
        .set('Cookie', instructorCookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const capstoneItems = res.body.filter(
        (item: any) => item.queueType === 'capstone_approval',
      );
      expect(capstoneItems.length).toBeGreaterThanOrEqual(1);

      const item = capstoneItems.find((i: any) => i.attemptId === attemptId);
      expect(item).toBeDefined();
      expect(item.queueType).toBe('capstone_approval');
      expect(item.studentName).toBe('Student One');
    });
  });
});
