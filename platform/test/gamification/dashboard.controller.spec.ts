import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exerciseRepo: ExerciseRepository;

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
    exerciseRepo = moduleFixture.get(ExerciseRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(email?: string): Promise<{ cookie: string; email: string }> {
    const userEmail = email ?? `user-${newId()}@test.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: userEmail,
        name: 'Tester',
        password: 'password123',
      });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;
    return { cookie, email: userEmail };
  }

  it('GET /api/dashboard/me returns streak, badges, rank, totalPoints for a student with a badge', async () => {
    const { cookie } = await registerAndGetCookie();

    // Submit to earn first_submit badge
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'Which?',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'Which?',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 100,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exId, 1);

    await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/dashboard/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toHaveProperty('streak');
    expect(res.body).toHaveProperty('badges');
    expect(res.body).toHaveProperty('rank');
    expect(res.body).toHaveProperty('totalPoints');
    expect(res.body.totalPoints).toBe(100);
    expect(Array.isArray(res.body.badges)).toBe(true);

    const earnedBadge = res.body.badges.find((b: any) => b.id === 'first_submit');
    expect(earnedBadge).toBeDefined();
    expect(earnedBadge.earned).toBe(true);
  });

  it('GET /api/dashboard/me returns empty state for a new user with no submissions', async () => {
    const { cookie } = await registerAndGetCookie();

    const res = await request(app.getHttpServer())
      .get('/api/dashboard/me')
      .set('Cookie', cookie)
      .expect(200);

    // User registered but hasn't submitted anything — no student record yet
    // Returns empty state: streak 0, no earned badges, null rank, 0 points
    expect(res.body.totalPoints).toBe(0);
    expect(res.body.streak).toBe(0);
    expect(res.body.rank).toBeNull();
    expect(Array.isArray(res.body.badges)).toBe(true);
    const allUnearned = res.body.badges.every((b: any) => b.earned === false);
    expect(allUnearned).toBe(true);
  });

  it('GET /api/dashboard/me returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/dashboard/me')
      .expect(401);
  });

  describe('extended payload (P10)', () => {
    it('returns the new fields in the empty-state response (no student row)', async () => {
      const { cookie } = await registerAndGetCookie();
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body).toMatchObject({
        streak: 0,
        streakIncrementedToday: false,
        rank: null,
        totalPoints: 0,
        pointsEarnedToday: 0,
        dailyXp: { earned: 0, target: 20 },
        mastery: { level: 1, xpInLevel: 0, xpForNextLevel: 100 },
        todayPlan: null,
      });
      expect(Array.isArray(res.body.badges)).toBe(true);
    });

    it('honours ?trackId= query param by passing it to TodayPlanService (no curriculum yet)', async () => {
      const { cookie } = await registerAndGetCookie();
      const res = await request(app.getHttpServer())
        .get('/api/dashboard/me')
        .query({ trackId: 'nonexistent-track' })
        .set('Cookie', cookie)
        .expect(200);

      // No curriculum, so todayPlan is null regardless of trackId
      expect(res.body.todayPlan).toBeNull();
    });
  });
});
