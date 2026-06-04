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
import { createUserAndLogin } from '../helpers/auth';

const mockDockerResult = {
  stdout: '',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  durationMs: 50,
};

const codePayload = {
  type: 'code' as const,
  language: 'swift' as const,
  starterCode: 'func greet() -> String { return "" }',
  testCode: 'assert(greet() == "hello")',
  testEntryPoint: 'greet',
};

describe('RunController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exerciseRepo: ExerciseRepository;
  const mockDockerRun = jest.fn().mockResolvedValue(mockDockerResult);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: mockDockerRun })
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
    mockDockerRun.mockResolvedValue(mockDockerResult);
  });

  /** Seed an active user and return the bc.access cookie value */
  async function getAuthCookie(): Promise<string> {
    const { cookie } = await createUserAndLogin(app, prisma);
    return cookie;
  }

  it('POST /api/run returns 401 without auth token', async () => {
    await request(app.getHttpServer())
      .post('/api/run')
      .send({ exerciseId: newId(), exerciseVersion: 1, code: 'code' })
      .expect(401);
  });

  it('POST /api/run returns 200 with valid auth token', async () => {
    const accessCookie = await getAuthCookie();
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'Write greet()',
      type: 'code',
      payload: codePayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exId, 1);

    const res = await request(app.getHttpServer())
      .post('/api/run')
      .set('Cookie', accessCookie)
      .send({ exerciseId: exId, exerciseVersion: 1, code: 'func greet() -> String { return "hello" }' })
      .expect(200);

    expect(res.body.outcome).toBe('passed');
  });

  it('POST /api/run returns 200 with passed outcome on happy path', async () => {
    const accessCookie = await getAuthCookie();
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'Write greet()',
      type: 'code',
      payload: codePayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exId, 1);

    const res = await request(app.getHttpServer())
      .post('/api/run')
      .set('Cookie', accessCookie)
      .send({ exerciseId: exId, exerciseVersion: 1, code: 'func greet() -> String { return "hello" }' })
      .expect(200);

    expect(res.body.outcome).toBe('passed');
    expect(res.body.passed).toBe(true);
  });

  it('POST /api/run returns 404 for unknown exercise', async () => {
    const accessCookie = await getAuthCookie();
    await request(app.getHttpServer())
      .post('/api/run')
      .set('Cookie', accessCookie)
      .send({ exerciseId: newId(), exerciseVersion: 1, code: 'code' })
      .expect(404);
  });

  it('POST /api/run returns 404 for draft exercise', async () => {
    const accessCookie = await getAuthCookie();
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'Write greet()',
      type: 'code',
      payload: codePayload,
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    // NOT published

    await request(app.getHttpServer())
      .post('/api/run')
      .set('Cookie', accessCookie)
      .send({ exerciseId: exId, exerciseVersion: 1, code: 'code' })
      .expect(404);
  });

  it('POST /api/run returns 400 when exerciseVersion is not a number', async () => {
    const accessCookie = await getAuthCookie();
    await request(app.getHttpServer())
      .post('/api/run')
      .set('Cookie', accessCookie)
      .send({ exerciseId: newId(), exerciseVersion: 'not-a-number', code: 'code' })
      .expect(400);
  });
});
