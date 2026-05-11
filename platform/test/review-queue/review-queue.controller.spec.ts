import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ReviewQueueController (e2e)', () => {
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

    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Tester', email: `s-${newId()}@t.com`, userId },
    });

    return { cookie, userId, studentId };
  }

  async function seedQuizExercise(): Promise<string> {
    const id = newId();
    await prisma.exercise.create({
      data: {
        id, version: 1, lessonId: newId(), promptMarkdown: 'p', type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
          correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    return id;
  }

  async function seedDueCard(studentId: string, exerciseId: string, step = 1): Promise<string> {
    const cardId = newId();
    await prisma.reviewCard.create({
      data: {
        id: cardId, studentId, exerciseId, step,
        nextDueAt: new Date(Date.now() - 3600 * 1000),
      },
    });
    return cardId;
  }

  describe('GET /api/review/queue', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer()).get('/api/review/queue').expect(401);
    });

    it('returns an empty array when nothing is due', async () => {
      const { cookie } = await registerAndGetCookie();
      const res = await request(app.getHttpServer())
        .get('/api/review/queue')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body).toEqual({ due: [] });
    });

    it('returns due cards with exercise payload', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const exerciseId = await seedQuizExercise();
      const cardId = await seedDueCard(studentId, exerciseId, 2);

      const res = await request(app.getHttpServer())
        .get('/api/review/queue')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.due).toHaveLength(1);
      expect(res.body.due[0]).toMatchObject({
        cardId, exerciseId, step: 2,
      });
      expect(res.body.due[0].exercise).toMatchObject({
        id: exerciseId, version: 1, type: 'multiple_choice', pointsMax: 10,
      });
      expect(res.body.due[0].exercise.payload).toBeTruthy();
    });
  });

  describe('POST /api/review/:cardId/submit', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(`/api/review/${newId()}/submit`)
        .send({ selectedOptionIds: ['a'] })
        .expect(401);
    });

    it("returns 404 for another student's card", async () => {
      const { cookie } = await registerAndGetCookie();
      const otherStudentId = newId();
      await prisma.student.create({
        data: { id: otherStudentId, name: 'Other', email: `o-${newId()}@t.com` },
      });
      const exerciseId = await seedQuizExercise();
      const cardId = await seedDueCard(otherStudentId, exerciseId);

      await request(app.getHttpServer())
        .post(`/api/review/${cardId}/submit`)
        .set('Cookie', cookie)
        .send({ selectedOptionIds: ['a'] })
        .expect(404);
    });

    it('returns 409 for a retired card', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const exerciseId = await seedQuizExercise();
      const cardId = newId();
      await prisma.reviewCard.create({
        data: {
          id: cardId, studentId, exerciseId, step: 4,
          nextDueAt: new Date(), retiredAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post(`/api/review/${cardId}/submit`)
        .set('Cookie', cookie)
        .send({ selectedOptionIds: ['a'] })
        .expect(409);
    });

    it('on pass advances the card and returns new state', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const exerciseId = await seedQuizExercise();
      const cardId = await seedDueCard(studentId, exerciseId, 1);

      const res = await request(app.getHttpServer())
        .post(`/api/review/${cardId}/submit`)
        .set('Cookie', cookie)
        .send({ selectedOptionIds: ['a'] })
        .expect(200);

      expect(res.body.passed).toBe(true);
      expect(res.body.card.step).toBe(2);
      expect(res.body.card.retiredAt).toBeNull();
    });

    it('on fail resets the card to step 1', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const exerciseId = await seedQuizExercise();
      const cardId = await seedDueCard(studentId, exerciseId, 3);

      const res = await request(app.getHttpServer())
        .post(`/api/review/${cardId}/submit`)
        .set('Cookie', cookie)
        .send({ selectedOptionIds: ['b'] })
        .expect(200);

      expect(res.body.passed).toBe(false);
      expect(res.body.card.step).toBe(1);
    });
  });
});
