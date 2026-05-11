import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReviewRepository } from '../../src/review/review.repository';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ReviewController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reviewRepository: ReviewRepository;
  let studentRepository: StudentRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    reviewRepository = moduleFixture.get(ReviewRepository);
    studentRepository = moduleFixture.get(StudentRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(
    email?: string,
  ): Promise<{ cookie: string; userId: string }> {
    const userEmail = email ?? `user-${newId()}@test.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, name: 'Tester', password: 'password123' });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;
    const userId = res.body.user.id;
    return { cookie, userId };
  }

  it('GET /api/reviews/:attemptId returns 200 with markdown when authorized', async () => {
    const { cookie, userId } = await registerAndGetCookie();

    // Create a student record for the user
    const studentId = newId();
    await studentRepository.create({
      id: studentId,
      name: 'Tester',
      email: `student-${newId()}@test.com`,
      userId,
    });

    const attemptId = newId();
    await reviewRepository.create({
      attemptId,
      studentId,
      markdown: '**Good job!** Idiomatic Swift.',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.markdown).toBe('**Good job!** Idiomatic Swift.');
    expect(res.body.createdAt).toBeDefined();
  });

  it('GET /api/reviews/:attemptId returns 403 when review belongs to another student', async () => {
    const { cookie } = await registerAndGetCookie();

    // Create a review for a different student
    const otherStudentId = newId();
    const attemptId = newId();
    await reviewRepository.create({
      attemptId,
      studentId: otherStudentId,
      markdown: '**Review** for another student.',
    });

    await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}`)
      .set('Cookie', cookie)
      .expect(403);
  });

  it('GET /api/reviews/:attemptId returns 404 when review does not exist', async () => {
    const { cookie } = await registerAndGetCookie();

    await request(app.getHttpServer())
      .get(`/api/reviews/${newId()}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('GET /api/reviews/:attemptId returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get(`/api/reviews/${newId()}`)
      .expect(401);
  });

  // ---- SSE streaming endpoint ----

  it('GET /api/reviews/:attemptId/stream streams chunk events terminated by done', async () => {
    const { cookie, userId } = await registerAndGetCookie();

    const studentId = newId();
    await studentRepository.create({
      id: studentId,
      name: 'Streamer',
      email: `streamer-${newId()}@test.com`,
      userId,
    });

    const attemptId = newId();
    await reviewRepository.create({
      attemptId,
      studentId,
      markdown: '# Looks good\n\nNice work.',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res: any, cb: any) => {
        let body = '';
        res.on('data', (c: Buffer) => {
          body += c.toString();
        });
        res.on('end', () => cb(null, body));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const body = res.body as string;
    const chunkEvents = (body.match(/event: chunk/g) ?? []).length;
    expect(chunkEvents).toBeGreaterThan(0);
    expect(body).toContain('event: done');
    const chunks = [...body.matchAll(/event: chunk\ndata: (.*)\n/g)].map((m) =>
      JSON.parse(m[1]),
    );
    expect(chunks.join('')).toBe('# Looks good\n\nNice work.');
  });

  it('GET /api/reviews/:attemptId/stream emits error:timeout when no review materialises', async () => {
    const { cookie, userId } = await registerAndGetCookie();

    const studentId = newId();
    await studentRepository.create({
      id: studentId,
      name: 'Waiter',
      email: `waiter-${newId()}@test.com`,
      userId,
    });

    const attemptId = newId();

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', cookie)
      .query({ timeoutMs: 50 })
      .buffer(true)
      .parse((res: any, cb: any) => {
        let body = '';
        res.on('data', (c: Buffer) => {
          body += c.toString();
        });
        res.on('end', () => cb(null, body));
      });

    const body = res.body as string;
    expect(body).toContain('event: error');
    expect(body).toContain('timeout');
  });

  it('GET /api/reviews/:attemptId/stream returns 403 when student does not own the review', async () => {
    const { userId: ownerUserId } =
      await registerAndGetCookie('owner@test.com');
    const { cookie: otherCookie, userId: otherUserId } =
      await registerAndGetCookie('other@test.com');

    const ownerStudentId = newId();
    await studentRepository.create({
      id: ownerStudentId,
      name: 'Owner',
      email: 'owner-student@test.com',
      userId: ownerUserId,
    });

    const otherStudentId = newId();
    await studentRepository.create({
      id: otherStudentId,
      name: 'Other',
      email: 'other-student@test.com',
      userId: otherUserId,
    });

    const attemptId = newId();
    await reviewRepository.create({
      attemptId,
      studentId: ownerStudentId,
      markdown: 'private review',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', otherCookie);

    expect(res.status).toBe(403);
    // Ownership check must fire BEFORE SSE headers; a regression that flips
    // the order would still produce an empty body but the content-type would
    // become text/event-stream instead of the JSON error envelope.
    expect(res.headers['content-type']).not.toContain('text/event-stream');
  });
});
