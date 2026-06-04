import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { createUserAndLogin } from '../helpers/auth';

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = mod.get(PrismaService);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('GET /api/admin/users is forbidden (403) for an instructor', async () => {
    const { cookie } = await createUserAndLogin(app, prisma, { role: 'instructor' });
    await request(app.getHttpServer()).get('/api/admin/users').set('Cookie', cookie).expect(403);
  });

  it('GET /api/admin/users returns 401 unauthenticated', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
  });

  it('admin can list users (no passwordHash leaked)', async () => {
    const { cookie } = await createUserAndLogin(app, prisma, { role: 'admin' });
    const res = await request(app.getHttpServer()).get('/api/admin/users').set('Cookie', cookie).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const u of res.body) expect(u.passwordHash).toBeUndefined();
  });

  it('admin can change another user\'s role', async () => {
    const { cookie } = await createUserAndLogin(app, prisma, { role: 'admin' });
    const target = await createUserAndLogin(app, prisma, { role: 'student' });
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/users/${target.userId}/role`)
      .set('Cookie', cookie).send({ role: 'instructor' }).expect(200);
    expect(res.body.role).toBe('instructor');
    const reloaded = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(reloaded?.role).toBe('instructor');
  });

  it('admin cannot change their OWN role (403)', async () => {
    const { cookie, userId } = await createUserAndLogin(app, prisma, { role: 'admin' });
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${userId}/role`)
      .set('Cookie', cookie).send({ role: 'student' }).expect(403);
  });

  it('instructor cannot change roles (403)', async () => {
    const { cookie } = await createUserAndLogin(app, prisma, { role: 'instructor' });
    const target = await createUserAndLogin(app, prisma, { role: 'student' });
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${target.userId}/role`)
      .set('Cookie', cookie).send({ role: 'admin' }).expect(403);
  });

  it('rejects an invalid role value (400)', async () => {
    const { cookie } = await createUserAndLogin(app, prisma, { role: 'admin' });
    const target = await createUserAndLogin(app, prisma, { role: 'student' });
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${target.userId}/role`)
      .set('Cookie', cookie).send({ role: 'superuser' }).expect(400);
  });
});
