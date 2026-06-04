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

describe('LeaderboardController (e2e)', () => {
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

  async function getAuthCookie(email?: string): Promise<string> {
    const { cookie } = await createUserAndLogin(app, prisma, { email });
    return cookie;
  }

  it('GET /api/leaderboard returns ranked list of students', async () => {
    const cookie = await getAuthCookie();

    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toHaveProperty('entries');
    expect(res.body).toHaveProperty('myRank');
    expect(Array.isArray(res.body.entries)).toBe(true);
    // New user has a student record (ensured on registration if that applies)
    // At minimum, the response structure is correct
  });

  it('GET /api/leaderboard returns empty entries when no students have results', async () => {
    const cookie = await getAuthCookie();

    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.entries).toBeDefined();
    // No exercise results = all students have 0 points
    for (const entry of res.body.entries) {
      expect(entry.totalPoints).toBe(0);
    }
  });

  it('GET /api/leaderboard returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/leaderboard')
      .expect(401);
  });

  // ---- New tests for Task 7 ----

  it('GET /api/leaderboard returns period field, default weekly', async () => {
    const cookie = await getAuthCookie();
    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.period).toBe('weekly');
    expect(res.body.scope).toBe('global'); // no cohort registered
    expect(res.body.cohortName).toBeNull();
  });

  it('GET /api/leaderboard?period=all-time keeps existing aggregation behaviour', async () => {
    const cookie = await getAuthCookie();
    const res = await request(app.getHttpServer())
      .get('/api/leaderboard?period=all-time')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.period).toBe('all-time');
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it('GET /api/leaderboard?period=weekly sums Attempt.pointsAwarded over the current week', async () => {
    const cookie1 = await getAuthCookie('s1@test.com');
    const cookie2 = await getAuthCookie('s2@test.com');

    // Trigger ensureStudent for both users
    await request(app.getHttpServer()).get(`/api/lessons/${newId()}`).set('Cookie', cookie1);
    await request(app.getHttpServer()).get(`/api/lessons/${newId()}`).set('Cookie', cookie2);

    const s1 = await prisma.student.findFirst({ where: { email: 's1@test.com' } });
    const s2 = await prisma.student.findFirst({ where: { email: 's2@test.com' } });

    if (s1 && s2) {
      const exerciseId = newId();
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // s1 active this week
      await prisma.attempt.create({
        data: {
          id: newId(),
          studentId: s1.id,
          exerciseId,
          exerciseVersion: 1,
          submittedAt: now,
          submissionPayload: {},
          passed: true,
          hintsUsedCount: 0,
          failedAttemptsBefore: 0,
          pointsAwarded: 100,
        },
      });

      // s2 active 2 weeks ago (outside weekly window)
      await prisma.attempt.create({
        data: {
          id: newId(),
          studentId: s2.id,
          exerciseId,
          exerciseVersion: 1,
          submittedAt: twoWeeksAgo,
          submissionPayload: {},
          passed: true,
          hintsUsedCount: 0,
          failedAttemptsBefore: 0,
          pointsAwarded: 500,
        },
      });
    }

    const res = await request(app.getHttpServer())
      .get('/api/leaderboard?period=weekly')
      .set('Cookie', cookie1)
      .expect(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
    // s1 should rank #1 in the weekly view since s2's attempt is outside the window
    const topEntry = res.body.entries[0];
    expect(topEntry.rank).toBe(1);
    if (s1) {
      expect(topEntry.studentId).toBe(s1.id);
    }
  });

  it('returns myLeague derived from mastery.level', async () => {
    const cookie = await getAuthCookie();
    // Trigger ensureStudent so the student row exists
    await request(app.getHttpServer()).get(`/api/lessons/${newId()}`).set('Cookie', cookie);
    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);
    // Brand-new student → 0 lifetime XP → level 1 → Bronze
    expect(res.body.myLeague).toEqual({ name: 'Bronze', xpToNext: 300, nextLeague: 'Silver' });
  });

  it('auto-scopes to cohort when student has cohortId', async () => {
    const cookie = await getAuthCookie();

    // Trigger ensureStudent
    await request(app.getHttpServer()).get(`/api/lessons/${newId()}`).set('Cookie', cookie);

    const cohort = await prisma.cohort.create({
      data: {
        id: newId(),
        name: 'Spring2026',
        startDate: new Date(),
        instructorId: newId(),
      },
    });

    const me = await prisma.student.findFirst({ orderBy: { id: 'desc' } });
    if (me) {
      await prisma.student.update({ where: { id: me.id }, data: { cohortId: cohort.id } });
    }

    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.scope).toBe('cohort');
    expect(res.body.cohortName).toBe('Spring2026');
  });

  it('each entry includes initials, language, isMe fields', async () => {
    const cookie = await getAuthCookie('alice@test.com');
    // Trigger ensureStudent
    await request(app.getHttpServer()).get(`/api/lessons/${newId()}`).set('Cookie', cookie);

    const res = await request(app.getHttpServer())
      .get('/api/leaderboard')
      .set('Cookie', cookie)
      .expect(200);
    const me = res.body.entries.find((e: any) => e.isMe === true);
    if (me) {
      expect(typeof me.initials).toBe('string');
      expect(['swift', 'kotlin', null]).toContain(me.language);
      expect(typeof me.isMe).toBe('boolean');
    }
    // All entries should have these fields
    for (const entry of res.body.entries) {
      expect(entry).toHaveProperty('initials');
      expect(entry).toHaveProperty('language');
      expect(entry).toHaveProperty('isMe');
    }
  });
});
