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

describe('ProgressController (e2e)', () => {
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

  it('GET /api/progress/me returns empty for new user who has not submitted', async () => {
    const cookie = await getAuthCookie();

    const res = await request(app.getHttpServer())
      .get('/api/progress/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.studentId).toBeNull();
    expect(res.body.results).toEqual([]);
    expect(res.body.totalPoints).toBe(0);
  });

  it('GET /api/progress/me returns results after a submission', async () => {
    const cookie = await getAuthCookie();
    const exId = await seedMcExercise();

    // Submit correct answer
    await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookie)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/progress/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.studentId).toBeTruthy();
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].exerciseId).toBe(exId);
    expect(res.body.results[0].passed).toBe(true);
    expect(res.body.results[0].pointsEarned).toBe(100);
    expect(res.body.totalPoints).toBe(100);
  });

  it('GET /api/progress/me returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/progress/me').expect(401);
  });
});
