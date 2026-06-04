import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';
import { createUserAndLogin } from '../helpers/auth';

describe('TrackController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let trackRepo: TrackRepository;
  let lessonRepo: LessonRepository;

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
    trackRepo = moduleFixture.get(TrackRepository);
    lessonRepo = moduleFixture.get(LessonRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(email?: string): Promise<{ cookie: string; userId: string }> {
    const { cookie, userId } = await createUserAndLogin(app, prisma, { email });
    return { cookie, userId };
  }

  async function seedPublishedTrackWithLesson(opts?: {
    trackTitle?: string;
    lessonTitle?: string;
  }): Promise<{ trackId: string; lessonId: string }> {
    const trackId = newId();
    const lessonId = newId();

    await lessonRepo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: opts?.lessonTitle ?? 'Intro Lesson',
      level: 'beginner',
      summary: 'Short summary',
      blocks: [],
    });
    await lessonRepo.publish(lessonId, 1);

    await trackRepo.createDraft({
      id: trackId,
      title: opts?.trackTitle ?? 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'Learn the Swift language',
      lessons: [{ id: lessonId, version: 1 }],
    });
    await trackRepo.publish(trackId, 1);

    return { trackId, lessonId };
  }

  it('GET /api/tracks returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/tracks').expect(401);
  });

  it('GET /api/tracks returns published tracks', async () => {
    const { cookie } = await registerAndGetCookie();
    const { trackId } = await seedPublishedTrackWithLesson({
      trackTitle: 'Swift Fundamentals',
    });

    const res = await request(app.getHttpServer())
      .get('/api/tracks')
      .set('Cookie', cookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const match = res.body.find((t: { id: string }) => t.id === trackId);
    expect(match).toBeDefined();
    expect(match.title).toBe('Swift Fundamentals');
    expect(match.language).toBe('swift');
    expect(match.kind).toBe('fundamentals');
    expect(match.version).toBe(1);
    expect(match.lessonCount).toBe(1);
    expect(match.starterRepoUrl).toBeNull();
  });

  it('GET /api/tracks omits unpublished tracks and returns latest published version', async () => {
    const { cookie } = await registerAndGetCookie();

    // Publish v1
    const { trackId } = await seedPublishedTrackWithLesson({ trackTitle: 'Track v1' });

    // Create v2 as draft (unpublished) — list should still show v1
    await trackRepo.createNextVersion(trackId, {
      title: 'Track v2 draft',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    // Unpublished-only track should not appear
    const draftOnlyId = newId();
    await trackRepo.createDraft({
      id: draftOnlyId,
      title: 'Draft Only',
      language: 'kotlin',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    const res = await request(app.getHttpServer())
      .get('/api/tracks')
      .set('Cookie', cookie)
      .expect(200);

    const match = res.body.find((t: { id: string }) => t.id === trackId);
    expect(match).toBeDefined();
    expect(match.version).toBe(1);
    expect(match.title).toBe('Track v1');

    const draftMatch = res.body.find((t: { id: string }) => t.id === draftOnlyId);
    expect(draftMatch).toBeUndefined();
  });

  it('GET /api/tracks/:id returns track with lessons', async () => {
    const { cookie } = await registerAndGetCookie();
    const { trackId, lessonId } = await seedPublishedTrackWithLesson({
      trackTitle: 'Kotlin Fundamentals',
      lessonTitle: 'Hello Kotlin',
    });

    const res = await request(app.getHttpServer())
      .get(`/api/tracks/${trackId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.id).toBe(trackId);
    expect(res.body.title).toBe('Kotlin Fundamentals');
    expect(res.body.lessonCount).toBe(1);
    expect(Array.isArray(res.body.lessons)).toBe(true);
    expect(res.body.lessons).toHaveLength(1);
    expect(res.body.lessons[0].id).toBe(lessonId);
    expect(res.body.lessons[0].title).toBe('Hello Kotlin');
    expect(res.body.lessons[0].version).toBe(1);
    expect(res.body.lessons[0].level).toBe('beginner');
    expect(res.body.lessons[0].position).toBe(0);
  });

  it('GET /api/tracks/:id returns 404 for non-existent', async () => {
    const { cookie } = await registerAndGetCookie();
    await request(app.getHttpServer())
      .get(`/api/tracks/${newId()}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('GET /api/tracks/:id returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get(`/api/tracks/${newId()}`)
      .expect(401);
  });
});
