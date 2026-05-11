import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';

describe('AuthController (e2e)', () => {
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

  function registerUser(email = 'alice@test.com', password = 'password123') {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, name: 'Alice', password });
  }

  it('POST /api/auth/register returns 201 and sets cookies', async () => {
    const res = await registerUser().expect(201);
    expect(res.body.user.email).toBe('alice@test.com');
    const cookies = res.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArr).toBeDefined();
    expect(cookieArr.some((c: string) => c.startsWith('bc.access='))).toBe(true);
    expect(cookieArr.some((c: string) => c.startsWith('bc.refresh='))).toBe(true);
  });

  it('POST /api/auth/register returns 409 on duplicate email', async () => {
    await registerUser().expect(201);
    await registerUser().expect(409);
  });

  it('POST /api/auth/login returns 200 with valid credentials', async () => {
    await registerUser().expect(201);
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' })
      .expect(200);
    expect(res.body.user.email).toBe('alice@test.com');
  });

  it('POST /api/auth/login returns 401 on wrong password', async () => {
    await registerUser().expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongpass' })
      .expect(401);
  });

  it('GET /api/auth/me returns 200 when authed', async () => {
    const regRes = await registerUser().expect(201);
    const rawCookies = regRes.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    const accessCookie = cookieArr.find((c: string) => c.startsWith('bc.access='))!;

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);

    expect(res.body.user.email).toBe('alice@test.com');
  });

  it('GET /api/auth/me returns 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /api/auth/logout returns 200 and clears cookies', async () => {
    const regRes = await registerUser().expect(201);
    const rawCookies = regRes.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    const accessCookie = cookieArr.find((c: string) => c.startsWith('bc.access='))!;

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', accessCookie)
      .expect(200);

    const rawSetCookies = res.headers['set-cookie'];
    const setCookies: string[] = rawSetCookies
      ? Array.isArray(rawSetCookies)
        ? rawSetCookies
        : [rawSetCookies]
      : [];
    // Cookies should be cleared (expired)
    const accessCleared = setCookies.some(
      (c: string) => c.startsWith('bc.access=') && c.includes('Expires=Thu, 01 Jan 1970'),
    );
    expect(accessCleared).toBe(true);
  });

  it('GET /api/auth/providers returns google boolean', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);
    expect(res.body).toHaveProperty('google');
    expect(typeof res.body.google).toBe('boolean');
  });
});
