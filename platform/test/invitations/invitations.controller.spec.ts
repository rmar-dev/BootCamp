import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { newId } from '../../src/shared/ids';
import { resetDb } from '../helpers/db';

describe('InvitationsController (e2e)', () => {
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

  const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
  const INSTRUCTOR_ID = '22222222-2222-4222-8222-222222222222';

  async function loginAs(role: 'admin' | 'instructor') {
    const id = role === 'admin' ? ADMIN_ID : INSTRUCTOR_ID;
    await prisma.user.create({
      data: {
        id,
        email: `${role}@test.com`,
        name: role,
        passwordHash: await bcrypt.hash('password123', 10),
        role,
        status: 'active',
      },
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `${role}@test.com`, password: 'password123' })
      .expect(200);
    const c = res.headers['set-cookie'] as unknown as string[];
    return (Array.isArray(c) ? c : [c]).find((x) => x.startsWith('bc.access='))!;
  }

  it('rejects an unauthenticated invite with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/invitations')
      .send({ email: 'a@x.com', name: 'A', role: 'instructor' })
      .expect(401);
  });

  it('instructor inviting role=instructor is silently downgraded to student and linked', async () => {
    const cookie = await loginAs('instructor');
    const res = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Cookie', cookie)
      .send({ email: 'sam@x.com', name: 'Sam', role: 'instructor' })
      .expect(201);
    expect(res.body.invitation.role).toBe('student');
    const student = await prisma.student.findUnique({ where: { email: 'sam@x.com' } });
    expect(student?.instructorId).toBe(INSTRUCTOR_ID);
  });

  it('admin can invite an instructor', async () => {
    const cookie = await loginAs('admin');
    const res = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Cookie', cookie)
      .send({ email: 'ivy@x.com', name: 'Ivy', role: 'instructor' })
      .expect(201);
    expect(res.body.invitation.role).toBe('instructor');
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('revoke disables the pending user and marks the invite revoked', async () => {
    const cookie = await loginAs('admin');
    const inv = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Cookie', cookie)
      .send({ email: 'rev@x.com', name: 'Rev', role: 'instructor' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/invitations/${inv.body.invitation.id}/revoke`)
      .set('Cookie', cookie)
      .expect(201);
    const u = await prisma.user.findUnique({ where: { email: 'rev@x.com' } });
    expect(u?.status).toBe('disabled');
  });

  it('full flow: admin invites instructor -> accept-invite -> login works', async () => {
    const adminCookie = await loginAs('admin');
    const inv = await request(app.getHttpServer())
      .post('/api/invitations')
      .set('Cookie', adminCookie)
      .send({ email: 'newinst@x.com', name: 'New Inst', role: 'instructor' })
      .expect(201);
    const token = inv.body.token as string;

    // cannot log in before accepting (status invited)
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'newinst@x.com', password: 'newpass123' })
      .expect(401);

    const accept = await request(app.getHttpServer())
      .post('/api/auth/accept-invite')
      .send({ token, password: 'newpass123' })
      .expect(201);
    expect(accept.body.user.email).toBe('newinst@x.com');
    expect(accept.body.user.status).toBe('active');

    // now login works
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'newinst@x.com', password: 'newpass123' })
      .expect(200);

    // the token is single-use: accepting again fails
    await request(app.getHttpServer())
      .post('/api/auth/accept-invite')
      .send({ token, password: 'whatever123' })
      .expect(400);
  });
});
