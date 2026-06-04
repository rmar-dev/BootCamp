import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { newId } from '../../src/shared/ids';
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

  async function seedUser(
    email = 'alice@test.com',
    password = 'password123',
    status: 'active' | 'invited' | 'disabled' = 'active',
    role: 'student' | 'instructor' | 'admin' = 'instructor',
  ) {
    await prisma.user.create({
      data: {
        id: newId(),
        email,
        name: 'Alice',
        passwordHash: await bcrypt.hash(password, 10),
        role,
        status,
      },
    });
  }

  function login(email = 'alice@test.com', password = 'password123') {
    return request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  }

  it('POST /api/auth/login returns 200 and sets cookies for an active user', async () => {
    await seedUser();
    const res = await login().expect(200);
    expect(res.body.user.email).toBe('alice@test.com');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const arr = Array.isArray(cookies) ? cookies : [cookies];
    expect(arr.some((c) => c.startsWith('bc.access='))).toBe(true);
    expect(arr.some((c) => c.startsWith('bc.refresh='))).toBe(true);
  });

  it('POST /api/auth/login returns 401 on wrong password', async () => {
    await seedUser();
    await login('alice@test.com', 'wrongpass').expect(401);
  });

  it('POST /api/auth/login returns 401 for an invited (not activated) user', async () => {
    await seedUser('pending@test.com', 'password123', 'invited');
    await login('pending@test.com', 'password123').expect(401);
  });

  it('POST /api/auth/login returns 401 for a disabled user', async () => {
    await seedUser('dis@test.com', 'password123', 'disabled');
    await login('dis@test.com', 'password123').expect(401);
  });

  it('GET /api/auth/me returns 200 when authed', async () => {
    await seedUser();
    const res = await login().expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const accessCookie = arr.find((c) => c.startsWith('bc.access='))!;
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);
    expect(me.body.user.email).toBe('alice@test.com');
  });

  it('GET /api/auth/me returns 401 without token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('POST /api/auth/logout returns 200 and clears cookies', async () => {
    await seedUser();
    const res = await login().expect(200);
    const raw = res.headers['set-cookie'] as unknown as string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const accessCookie = arr.find((c) => c.startsWith('bc.access='))!;
    const out = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', accessCookie)
      .expect(200);
    const rawSet = out.headers['set-cookie'] as unknown as string[];
    const setArr = rawSet ? (Array.isArray(rawSet) ? rawSet : [rawSet]) : [];
    expect(
      setArr.some((c) => c.startsWith('bc.access=') && c.includes('Expires=Thu, 01 Jan 1970')),
    ).toBe(true);
  });

  it('GET /api/auth/providers reports google: false', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);
    expect(res.body.google).toBe(false);
  });

  it('removed: POST /api/auth/register returns 404', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'x@test.com', name: 'X', password: 'password123' })
      .expect(404);
  });

  it('removed: GET /api/auth/google returns 404', async () => {
    await request(app.getHttpServer()).get('/api/auth/google').expect(404);
  });

  it('POST /api/auth/accept-invite with a bad token returns 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/accept-invite')
      .send({ token: 'deadbeef', password: 'newpass123' })
      .expect(400);
  });
});
