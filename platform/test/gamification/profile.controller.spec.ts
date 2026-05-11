// test/gamification/profile.controller.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('GET /api/profile/me', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = m.get(PrismaService);
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
        email: `u-${newId()}@test.com`,
        name: 'U',
        password: 'password123',
      });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.find((c) => c.startsWith('bc.access='))!;
  }

  it('returns the full ProfileResponse for the authenticated student', async () => {
    const cookie = await getAuthCookie();
    const res = await request(app.getHttpServer())
      .get('/api/profile/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.account).toBeDefined();
    expect(res.body.account.name).toBe('U');
    expect(res.body.heatStrip).toHaveLength(182);
    expect(res.body.kpis).toBeDefined();
    expect(Array.isArray(res.body.skills)).toBe(true);
    expect(Array.isArray(res.body.badges)).toBe(true);
    expect(Array.isArray(res.body.trackBadges)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/profile/me').expect(401);
  });
});
