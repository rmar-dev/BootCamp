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

const mcPayload = {
  type: 'multiple_choice' as const,
  questionMarkdown: 'Which is correct?',
  options: [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
  ],
  correctOptionIds: ['a'],
  multiSelect: false,
};

describe('SubmitController (e2e)', () => {
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

  async function getAuthCookie(email?: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: email ?? `user-${newId()}@test.com`,
        name: 'Tester',
        password: 'password123',
      });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.find((c: string) => c.startsWith('bc.access='))!;
  }

  async function seedMcExercise(): Promise<string> {
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'Which?',
      type: 'multiple_choice',
      payload: mcPayload,
      pointsMax: 100,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exId, 1);
    return exId;
  }

  it('POST /api/submit 200 for correct MC → passed=true, pointsAwarded=100, totalPoints=100', async () => {
    const cookie = await getAuthCookie();
    const exId = await seedMcExercise();

    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] })
      .expect(200);

    expect(res.body.passed).toBe(true);
    expect(res.body.pointsAwarded).toBe(100);
    expect(res.body.totalPoints).toBe(100);
  });

  it('POST /api/submit 200 for wrong MC → passed=false, pointsAwarded=0', async () => {
    const cookie = await getAuthCookie();
    const exId = await seedMcExercise();

    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['b'] })
      .expect(200);

    expect(res.body.passed).toBe(false);
    expect(res.body.pointsAwarded).toBe(0);
  });

  it('POST /api/submit 401 without auth', async () => {
    const exId = await seedMcExercise();
    await request(app.getHttpServer())
      .post('/api/submit')
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] })
      .expect(401);
  });

  it('POST /api/submit 404 for missing exercise', async () => {
    const cookie = await getAuthCookie();
    await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: newId(), exerciseVersion: 1, answer: ['a'] })
      .expect(404);
  });

  it('Scoring penalizes failed attempts: fail first, then pass → pointsAwarded: 95', async () => {
    const cookie = await getAuthCookie();
    const exId = await seedMcExercise();

    // First attempt: fail
    await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['b'] })
      .expect(200);

    // Second attempt: pass
    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] })
      .expect(200);

    expect(res.body.passed).toBe(true);
    // 100 - 5% * 1 failed attempt = 95
    expect(res.body.pointsAwarded).toBe(95);
  });
});
