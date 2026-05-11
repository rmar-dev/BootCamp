# Progress & Mastery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `ProgressModule` on the platform with two read endpoints (`GET /api/progress/tracks/:trackId` and `GET /api/progress/concepts`), then surface their data in three places on the web: track-detail timeline state markers + smart CTA, tracks-list "Continue where you left off" row, and a Concept Mastery panel on the dashboard. No schema changes — all data is derived from existing `ExerciseResult` / `Attempt` / `Block` / `Exercise` rows.

**Architecture:** `ProgressModule` hosts a `ProgressAggregatorService` (**note:** renamed from the spec's `ProgressService` because `src/state/services/progress.service.ts` already exists — the existing class is a single-lesson/track boolean checker, the new class returns rich aggregations). Service uses `PrismaService` directly for bulk queries (no N+1) and reuses `TrackRepository` / `StudentRepository` for single-record lookups. Web side: one fetch module (`lib/progress.ts`) drives three UI touchpoints (timeline node, tracks-list continue row, concept-mastery panel). Progress-fetch failures degrade gracefully — UI renders the not-started/empty state instead of breaking the page.

**Tech Stack:** Backend: NestJS 10, Prisma 5, Jest (e2e + state-service unit). Frontend: Next.js 14, React 18, Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-04-23-progress-and-mastery-design.md](../specs/2026-04-23-progress-and-mastery-design.md)

**Baseline (verified at planning time):**
- Platform `master` at `1df0835`, working branch `feat/adaptive-content-engine` at `99ef6c8`.
- Web `master` at `142353e`, working branch `feat/adaptive-content-engine` at `a2acc22`.
- This plan branches **from platform `master`** and **from web `master`** — *not* from the adaptive-content-engine branches. Create branches explicitly in Task P0 and W0.

---

## Task P0: Platform branch

**Files:** none (branch setup only).

- [ ] **Step 1: Create platform branch from master**

```bash
cd c:/Users/ricma/BootCamp/platform
git fetch
git checkout master
git pull --ff-only
git checkout -b feat/progress-mastery
```

- [ ] **Step 2: Verify baseline tests pass**

```bash
npm test
```

Expected: all existing tests pass (this establishes the green baseline before we add anything).

---

## Task P1: Scaffold ProgressModule

**Files:**
- Create: `platform/src/progress/progress.module.ts`
- Create: `platform/src/progress/progress.service.ts`
- Create: `platform/src/progress/progress.controller.ts`
- Modify: `platform/src/app.module.ts`

- [ ] **Step 1: Create empty service file**

Create `platform/src/progress/progress.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackRepository } from '../content/repositories/track.repository';
import { StudentRepository } from '../state/repositories/student.repository';

export type LessonProgress = {
  lessonId: string;
  lessonVersion: number;
  totalExercises: number;
  passedExercises: number;
  attemptedExercises: number;
  state: 'not_started' | 'in_progress' | 'complete';
  lastAttemptAt: string | null;
};

export type TrackProgress = {
  trackId: string;
  lessons: LessonProgress[];
};

export type ConceptProgress = {
  concept: string;
  totalExercises: number;
  passedExercises: number;
};

export type ConceptsProgress = {
  concepts: ConceptProgress[];
};

@Injectable()
export class ProgressAggregatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracks: TrackRepository,
    private readonly students: StudentRepository,
  ) {}
}
```

- [ ] **Step 2: Create empty controller file**

Create `platform/src/progress/progress.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { ProgressAggregatorService } from './progress.service';

@Controller('api/progress')
export class ProgressController {
  constructor(private readonly service: ProgressAggregatorService) {}
}
```

- [ ] **Step 3: Create module file**

Create `platform/src/progress/progress.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentModule } from '../content/content.module';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { ProgressAggregatorService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, AuthModule],
  controllers: [ProgressController],
  providers: [ProgressAggregatorService],
  exports: [ProgressAggregatorService],
})
export class ProgressModule {}
```

- [ ] **Step 4: Register in AppModule**

Modify `platform/src/app.module.ts` — add the import and include in `imports` array:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContentModule } from './content/content.module';
import { StateModule } from './state/state.module';
import { ExecutionModule } from './execution/execution.module';
import { AuthModule } from './auth/auth.module';
import { SubmissionModule } from './submission/submission.module';
import { GamificationModule } from './gamification/gamification.module';
import { ReviewModule } from './review/review.module';
import { InstructorReviewModule } from './instructor-review/instructor-review.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, ExecutionModule, AuthModule, SubmissionModule, GamificationModule, ReviewModule, InstructorReviewModule, ProgressModule],
})
export class AppModule {}
```

- [ ] **Step 5: Build to verify module wires up**

```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: `nest build` succeeds with no errors (empty module registers correctly and DI resolves).

- [ ] **Step 6: Run tests to make sure nothing regressed**

```bash
npm test
```

Expected: all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/progress/ src/app.module.ts
git commit -m "feat(progress): scaffold ProgressModule + empty aggregator service"
```

---

## Task P2: Track progress aggregation (TDD)

**Files:**
- Modify: `platform/src/progress/progress.service.ts` (add `getTrackProgress`)
- Create: `platform/test/progress/progress.service.spec.ts`

Follow the same unit-test pattern as `test/state/progress.service.spec.ts` — real Prisma client, `resetDb` between tests, seed via repositories.

- [ ] **Step 1: Write the failing test file**

Create `platform/test/progress/progress.service.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { ProgressAggregatorService } from '../../src/progress/progress.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressAggregatorService — track progress', () => {
  let prisma: PrismaClient;
  let svc: ProgressAggregatorService;
  let tracks: TrackRepository;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let students: StudentRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    tracks = new TrackRepository(prisma as any);
    lessons = new LessonRepository(prisma as any);
    exercises = new ExerciseRepository(prisma as any);
    students = new StudentRepository(prisma as any);
    svc = new ProgressAggregatorService(prisma as any, tracks, students);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeExercise(concepts: string[] = []): Promise<string> {
    const id = newId();
    await exercises.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts,
    });
    await exercises.publish(id, 1);
    return id;
  }

  async function makeLessonWithExercises(trackId: string, position: number, exerciseIds: string[]): Promise<{ lessonId: string; lessonVersion: number }> {
    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId,
      trackId,
      position,
      title: `Lesson ${position}`,
      level: 'beginner',
      summary: 's',
      blocks: exerciseIds.map((exerciseId, i) => ({
        id: newId(),
        position: i,
        kind: 'exercise' as const,
        exerciseId,
        exerciseVersion: 1,
      })),
    });
    await lessons.publish(lessonId, 1);
    return { lessonId, lessonVersion: 1 };
  }

  async function makeStudent(): Promise<string> {
    const s = await students.create({ id: newId(), name: 'S', email: `s-${newId()}@t.com` });
    return s.id;
  }

  async function seedAttemptAndResult(
    studentId: string,
    exerciseId: string,
    passed: boolean,
    submittedAt: Date = new Date(),
  ): Promise<void> {
    const attemptId = newId();
    await prisma.attempt.create({
      data: {
        id: attemptId,
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submittedAt,
        submissionPayload: {},
        passed,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: passed ? 10 : 0,
      },
    });
    if (passed) {
      await prisma.exerciseResult.create({
        data: {
          id: newId(),
          studentId,
          exerciseId,
          bestAttemptId: attemptId,
          passed: true,
          pointsEarned: 10,
          attemptsCount: 1,
          firstPassedAt: submittedAt,
        },
      });
    }
  }

  it('returns not_started for a lesson with no attempts', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result.trackId).toBe(trackId);
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0]).toMatchObject({
      lessonId, lessonVersion, totalExercises: 2, passedExercises: 0,
      attemptedExercises: 0, state: 'not_started', lastAttemptAt: null,
    });
  });

  it('returns in_progress when some but not all exercises passed', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const exC = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB, exC]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);
    const when = new Date('2026-04-20T10:00:00Z');
    await seedAttemptAndResult(studentId, exA, true, when);
    await seedAttemptAndResult(studentId, exB, false, new Date('2026-04-21T10:00:00Z'));

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result.lessons[0]).toMatchObject({
      totalExercises: 3, passedExercises: 1, attemptedExercises: 2, state: 'in_progress',
    });
    expect(result.lessons[0].lastAttemptAt).toBe('2026-04-21T10:00:00.000Z');
  });

  it('returns complete when every exercise passed', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const exA = await makeExercise();
    const exB = await makeExercise();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, [exA, exB]);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);
    await seedAttemptAndResult(studentId, exA, true);
    await seedAttemptAndResult(studentId, exB, true);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result.lessons[0].state).toBe('complete');
    expect(result.lessons[0].passedExercises).toBe(2);
  });

  it('returns empty lessons array for a published track with no lessons', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result.lessons).toEqual([]);
  });

  it('treats a lesson with no exercise blocks as not_started (totalExercises=0)', async () => {
    const studentId = await makeStudent();
    const trackId = newId();
    const { lessonId, lessonVersion } = await makeLessonWithExercises(trackId, 0, []);
    await tracks.createDraft({
      id: trackId, title: 'T', language: 'swift', kind: 'fundamentals',
      description: 'd', lessons: [{ id: lessonId, version: lessonVersion }],
    });
    await tracks.publish(trackId, 1);

    const result = await svc.getTrackProgress(studentId, trackId);

    expect(result.lessons[0]).toMatchObject({
      totalExercises: 0, passedExercises: 0, attemptedExercises: 0, state: 'not_started',
    });
  });

  it('returns null when the track does not exist', async () => {
    const studentId = await makeStudent();
    const result = await svc.getTrackProgress(studentId, newId());
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
cd c:/Users/ricma/BootCamp/platform
npm test -- test/progress/progress.service.spec.ts
```

Expected: FAIL — `svc.getTrackProgress is not a function` (the method doesn't exist yet).

- [ ] **Step 3: Implement `getTrackProgress`**

Modify `platform/src/progress/progress.service.ts` — add the method inside the `ProgressAggregatorService` class:

```ts
async getTrackProgress(
  studentId: string,
  trackId: string,
): Promise<TrackProgress | null> {
  const track = await this.tracks.findLatestPublished(trackId);
  if (!track) return null;

  if (track.lessonIds.length === 0) {
    return { trackId, lessons: [] };
  }

  // Load all lessons by composite key in one query
  const lessonKeys = track.lessonIds.map((id, i) => ({ id, version: track.lessonVersions[i] }));
  const lessonRows = await this.prisma.lesson.findMany({
    where: { OR: lessonKeys.map((k) => ({ id: k.id, version: k.version })) },
  });
  const lessonByKey = new Map<string, (typeof lessonRows)[number]>();
  for (const l of lessonRows) lessonByKey.set(`${l.id}:${l.version}`, l);

  // Load all blocks for these lesson versions
  const blocks = await this.prisma.block.findMany({
    where: {
      OR: lessonKeys.map((k) => ({ lessonId: k.id, lessonVersion: k.version })),
    },
  });

  // Map lesson -> exerciseIds
  const exerciseIdsByLesson = new Map<string, string[]>();
  for (const key of lessonKeys) exerciseIdsByLesson.set(`${key.id}:${key.version}`, []);
  const allExerciseIds: string[] = [];
  for (const b of blocks) {
    if (b.kind !== 'exercise' || !b.exerciseId) continue;
    const key = `${b.lessonId}:${b.lessonVersion}`;
    const list = exerciseIdsByLesson.get(key);
    if (list) {
      list.push(b.exerciseId);
      allExerciseIds.push(b.exerciseId);
    }
  }

  if (allExerciseIds.length === 0) {
    return {
      trackId,
      lessons: lessonKeys.map((k) => ({
        lessonId: k.id,
        lessonVersion: k.version,
        totalExercises: 0,
        passedExercises: 0,
        attemptedExercises: 0,
        state: 'not_started' as const,
        lastAttemptAt: null,
      })),
    };
  }

  const [passedResults, attemptGroups] = await Promise.all([
    this.prisma.exerciseResult.findMany({
      where: { studentId, passed: true, exerciseId: { in: allExerciseIds } },
      select: { exerciseId: true },
    }),
    this.prisma.attempt.groupBy({
      by: ['exerciseId'],
      where: { studentId, exerciseId: { in: allExerciseIds } },
      _max: { submittedAt: true },
    }),
  ]);

  const passedSet = new Set(passedResults.map((r) => r.exerciseId));
  const lastAttemptByExercise = new Map<string, Date>();
  for (const g of attemptGroups) {
    if (g._max.submittedAt) lastAttemptByExercise.set(g.exerciseId, g._max.submittedAt);
  }

  const lessons: LessonProgress[] = lessonKeys.map((k) => {
    const exerciseIds = exerciseIdsByLesson.get(`${k.id}:${k.version}`) ?? [];
    const totalExercises = exerciseIds.length;
    let passedExercises = 0;
    let attemptedExercises = 0;
    let lastAttemptAt: Date | null = null;
    for (const exId of exerciseIds) {
      if (passedSet.has(exId)) passedExercises++;
      const last = lastAttemptByExercise.get(exId);
      if (last) {
        attemptedExercises++;
        if (!lastAttemptAt || last > lastAttemptAt) lastAttemptAt = last;
      }
    }
    let state: 'not_started' | 'in_progress' | 'complete';
    if (attemptedExercises === 0) state = 'not_started';
    else if (totalExercises > 0 && passedExercises === totalExercises) state = 'complete';
    else state = 'in_progress';
    return {
      lessonId: k.id,
      lessonVersion: k.version,
      totalExercises,
      passedExercises,
      attemptedExercises,
      state,
      lastAttemptAt: lastAttemptAt ? lastAttemptAt.toISOString() : null,
    };
  });

  return { trackId, lessons };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- test/progress/progress.service.spec.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/progress/progress.service.ts test/progress/
git commit -m "feat(progress): aggregate track progress with bulk queries"
```

---

## Task P3: Track progress endpoint (controller + e2e)

**Files:**
- Modify: `platform/src/progress/progress.controller.ts`
- Create: `platform/test/progress/progress.controller.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `platform/test/progress/progress.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressController (e2e)', () => {
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

  async function registerAndGetCookie(): Promise<{ cookie: string; userId: string; studentId: string }> {
    const userEmail = `user-${newId()}@test.com`;
    const password = 'password123';
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, name: 'Tester', password });
    const userId: string = regRes.body.user.id;
    const raw = regRes.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;

    // Create the Student record linked to this user
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Tester', email: `student-${newId()}@test.com`, userId },
    });

    return { cookie, userId, studentId };
  }

  async function seedTrackWithOneLesson(): Promise<{ trackId: string; lessonId: string; exerciseId: string }> {
    const exerciseId = newId();
    await prisma.exercise.create({
      data: {
        id: exerciseId, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    const lessonId = newId();
    const trackId = newId();
    await prisma.lesson.create({
      data: {
        id: lessonId, version: 1, trackId, position: 0, title: 'L',
        level: 'beginner', summary: 's', blockIds: [], publishedAt: new Date(),
      },
    });
    await prisma.block.create({
      data: {
        id: newId(), lessonId, lessonVersion: 1, position: 0,
        kind: 'exercise', exerciseId, exerciseVersion: 1,
      },
    });
    await prisma.track.create({
      data: {
        id: trackId, version: 1, title: 'T', language: 'swift', kind: 'fundamentals',
        description: 'd', lessonIds: [lessonId], lessonVersions: [1], publishedAt: new Date(),
      },
    });
    return { trackId, lessonId, exerciseId };
  }

  describe('GET /api/progress/tracks/:trackId', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`/api/progress/tracks/${newId()}`)
        .expect(401);
    });

    it('returns 404 for a non-existent track', async () => {
      const { cookie } = await registerAndGetCookie();
      await request(app.getHttpServer())
        .get(`/api/progress/tracks/${newId()}`)
        .set('Cookie', cookie)
        .expect(404);
    });

    it('returns lesson progress with correct states for mixed attempts', async () => {
      const { cookie, studentId } = await registerAndGetCookie();
      const { trackId, lessonId, exerciseId } = await seedTrackWithOneLesson();

      // Seed a passing attempt + result
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId, exerciseVersion: 1,
          submittedAt: new Date('2026-04-22T12:00:00Z'),
          submissionPayload: {}, passed: true, hintsUsedCount: 0,
          failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.trackId).toBe(trackId);
      expect(res.body.lessons).toHaveLength(1);
      expect(res.body.lessons[0]).toMatchObject({
        lessonId, lessonVersion: 1, totalExercises: 1,
        passedExercises: 1, attemptedExercises: 1, state: 'complete',
      });
      expect(res.body.lessons[0].lastAttemptAt).toBe('2026-04-22T12:00:00.000Z');
    });

    it('returns all not_started lessons for a student with no attempts', async () => {
      const { cookie } = await registerAndGetCookie();
      const { trackId } = await seedTrackWithOneLesson();

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.lessons[0].state).toBe('not_started');
      expect(res.body.lessons[0].passedExercises).toBe(0);
    });

    it('returns empty lessons when caller has no Student record', async () => {
      // Register a user but do NOT create a Student linked to them
      const userEmail = `user-${newId()}@test.com`;
      const regRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: userEmail, name: 'Tester', password: 'password123' });
      const raw = regRes.headers['set-cookie'] as string | string[];
      const arr = Array.isArray(raw) ? raw : [raw];
      const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;

      const { trackId } = await seedTrackWithOneLesson();

      const res = await request(app.getHttpServer())
        .get(`/api/progress/tracks/${trackId}`)
        .set('Cookie', cookie)
        .expect(200);

      // No student => treat as zero attempts for every lesson
      expect(res.body.lessons).toHaveLength(1);
      expect(res.body.lessons[0].state).toBe('not_started');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- test/progress/progress.controller.spec.ts
```

Expected: FAIL — `GET /api/progress/tracks/:trackId` returns 404 (route not registered yet).

- [ ] **Step 3: Implement the controller method**

Modify `platform/src/progress/progress.controller.ts`:

```ts
import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ProgressAggregatorService, TrackProgress } from './progress.service';

@Controller('api/progress')
export class ProgressController {
  constructor(
    private readonly service: ProgressAggregatorService,
    private readonly students: StudentRepository,
  ) {}

  @Get('tracks/:trackId')
  @UseGuards(JwtAuthGuard)
  async getTrackProgress(
    @Param('trackId') trackId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<TrackProgress> {
    const student = await this.students.findByUserId(user.userId);
    // If the user has no Student record yet, treat as zero-activity:
    // still return the track shape with all lessons as not_started.
    const studentId = student?.id ?? '';

    const progress = await this.service.getTrackProgress(studentId, trackId);
    if (!progress) throw new NotFoundException(`Track ${trackId} not found`);
    return progress;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- test/progress/progress.controller.spec.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/progress/progress.controller.ts test/progress/progress.controller.spec.ts
git commit -m "feat(progress): add GET /api/progress/tracks/:trackId"
```

---

## Task P4: Concept progress aggregation (TDD)

**Files:**
- Modify: `platform/src/progress/progress.service.ts` (add `getConceptProgress`)
- Modify: `platform/test/progress/progress.service.spec.ts` (add concept tests)

- [ ] **Step 1: Add failing concept-progress tests**

Append to `platform/test/progress/progress.service.spec.ts` (inside the existing `describe` block, after the track-progress tests):

```ts
describe('concept progress', () => {
  it('returns empty concepts array when no exercises exist', async () => {
    const studentId = await makeStudent();
    const result = await svc.getConceptProgress(studentId);
    expect(result.concepts).toEqual([]);
  });

  it('counts total exercises per concept across all published exercises', async () => {
    const studentId = await makeStudent();
    await makeExercise(['functions', 'strings']);
    await makeExercise(['functions']);
    await makeExercise(['strings']);

    const result = await svc.getConceptProgress(studentId);

    const functions = result.concepts.find((c) => c.concept === 'functions')!;
    const strings = result.concepts.find((c) => c.concept === 'strings')!;
    expect(functions.totalExercises).toBe(2);
    expect(strings.totalExercises).toBe(2);
    expect(functions.passedExercises).toBe(0);
    expect(strings.passedExercises).toBe(0);
  });

  it('counts passed exercises per concept for the student', async () => {
    const studentId = await makeStudent();
    const exA = await makeExercise(['functions', 'strings']);
    const exB = await makeExercise(['functions']);
    await makeExercise(['strings']);
    await seedAttemptAndResult(studentId, exA, true);
    await seedAttemptAndResult(studentId, exB, true);

    const result = await svc.getConceptProgress(studentId);

    const functions = result.concepts.find((c) => c.concept === 'functions')!;
    const strings = result.concepts.find((c) => c.concept === 'strings')!;
    expect(functions).toMatchObject({ totalExercises: 2, passedExercises: 2 });
    expect(strings).toMatchObject({ totalExercises: 2, passedExercises: 1 });
  });

  it('sorts by passedExercises DESC, then concept ASC', async () => {
    const studentId = await makeStudent();
    const exA = await makeExercise(['zeta']);
    const exB = await makeExercise(['alpha']);
    await makeExercise(['beta']);
    await seedAttemptAndResult(studentId, exA, true);
    await seedAttemptAndResult(studentId, exB, true);

    const result = await svc.getConceptProgress(studentId);

    // alpha and zeta both have passedExercises=1; alpha first (ASC tiebreak).
    // beta has passedExercises=0 (last).
    expect(result.concepts.map((c) => c.concept)).toEqual(['alpha', 'zeta', 'beta']);
  });

  it('excludes exercises that are not published', async () => {
    const studentId = await makeStudent();
    const publishedId = newId();
    await exercises.createDraft({
      id: publishedId, lessonId: newId(), promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: { type: 'multiple_choice', questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      pointsMax: 10, hints: [], concepts: ['visible'],
    });
    await exercises.publish(publishedId, 1);
    const draftId = newId();
    await exercises.createDraft({
      id: draftId, lessonId: newId(), promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: { type: 'multiple_choice', questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      pointsMax: 10, hints: [], concepts: ['hidden'],
    });

    const result = await svc.getConceptProgress(studentId);
    expect(result.concepts.map((c) => c.concept)).toContain('visible');
    expect(result.concepts.map((c) => c.concept)).not.toContain('hidden');
  });

  it('collapses multiple versions of the same exercise to the latest', async () => {
    const studentId = await makeStudent();
    const exId = newId();
    await exercises.createDraft({
      id: exId, lessonId: newId(), promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: { type: 'multiple_choice', questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      pointsMax: 10, hints: [], concepts: ['v1-only'],
    });
    await exercises.publish(exId, 1);
    await exercises.createNextVersion(exId, {
      lessonId: newId(), promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: { type: 'multiple_choice', questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      pointsMax: 10, hints: [], concepts: ['v2'],
    });
    await exercises.publish(exId, 2);

    const result = await svc.getConceptProgress(studentId);

    // Only v2 concepts should appear — v1-only was superseded
    expect(result.concepts.map((c) => c.concept)).toEqual(['v2']);
    expect(result.concepts.find((c) => c.concept === 'v2')!.totalExercises).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- test/progress/progress.service.spec.ts
```

Expected: FAIL — `svc.getConceptProgress is not a function`.

- [ ] **Step 3: Implement `getConceptProgress`**

Add to `platform/src/progress/progress.service.ts` (inside the `ProgressAggregatorService` class):

```ts
async getConceptProgress(studentId: string): Promise<ConceptsProgress> {
  const [publishedExercises, passedResults] = await Promise.all([
    this.prisma.exercise.findMany({
      where: { publishedAt: { not: null } },
      select: { id: true, version: true, concepts: true },
    }),
    studentId
      ? this.prisma.exerciseResult.findMany({
          where: { studentId, passed: true },
          select: { exerciseId: true },
        })
      : Promise.resolve([] as { exerciseId: string }[]),
  ]);

  // Collapse to latest version per exercise id
  type LatestEntry = { concepts: string[]; version: number };
  const latestByExercise = new Map<string, LatestEntry>();
  for (const ex of publishedExercises) {
    const existing = latestByExercise.get(ex.id);
    if (!existing || ex.version > existing.version) {
      latestByExercise.set(ex.id, { concepts: ex.concepts, version: ex.version });
    }
  }

  const passedSet = new Set(passedResults.map((r) => r.exerciseId));

  const counts = new Map<string, { total: number; passed: number }>();
  for (const [exerciseId, { concepts }] of latestByExercise.entries()) {
    for (const concept of concepts) {
      let c = counts.get(concept);
      if (!c) {
        c = { total: 0, passed: 0 };
        counts.set(concept, c);
      }
      c.total++;
      if (passedSet.has(exerciseId)) c.passed++;
    }
  }

  const list: ConceptProgress[] = [...counts.entries()].map(([concept, v]) => ({
    concept,
    totalExercises: v.total,
    passedExercises: v.passed,
  }));

  list.sort((a, b) => {
    if (b.passedExercises !== a.passedExercises) return b.passedExercises - a.passedExercises;
    return a.concept.localeCompare(b.concept);
  });

  return { concepts: list };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- test/progress/progress.service.spec.ts
```

Expected: all concept tests pass, plus the earlier track tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/progress/progress.service.ts test/progress/progress.service.spec.ts
git commit -m "feat(progress): aggregate concept mastery across published exercises"
```

---

## Task P5: Concepts endpoint (controller + e2e)

**Files:**
- Modify: `platform/src/progress/progress.controller.ts`
- Modify: `platform/test/progress/progress.controller.spec.ts`

- [ ] **Step 1: Add failing e2e tests**

Append to `platform/test/progress/progress.controller.spec.ts` (as a new `describe` block after the tracks describe):

```ts
describe('GET /api/progress/concepts', () => {
  it('returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/progress/concepts')
      .expect(401);
  });

  it('returns counts across all published exercises', async () => {
    const { cookie, studentId } = await registerAndGetCookie();

    const exA = newId();
    await prisma.exercise.create({
      data: {
        id: exA, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['functions', 'strings'], publishedAt: new Date(),
      },
    });
    const exB = newId();
    await prisma.exercise.create({
      data: {
        id: exB, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['functions'], publishedAt: new Date(),
      },
    });

    // Pass exA only
    const attemptId = newId();
    await prisma.attempt.create({
      data: {
        id: attemptId, studentId, exerciseId: exA, exerciseVersion: 1,
        submittedAt: new Date(), submissionPayload: {}, passed: true,
        hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
      },
    });
    await prisma.exerciseResult.create({
      data: {
        id: newId(), studentId, exerciseId: exA, bestAttemptId: attemptId,
        passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/progress/concepts')
      .set('Cookie', cookie)
      .expect(200);

    const byConcept = Object.fromEntries(
      res.body.concepts.map((c: any) => [c.concept, c]),
    );
    expect(byConcept.functions).toMatchObject({ totalExercises: 2, passedExercises: 1 });
    expect(byConcept.strings).toMatchObject({ totalExercises: 1, passedExercises: 1 });
  });

  it('returns 0/N for a student with no attempts', async () => {
    const { cookie } = await registerAndGetCookie();
    await prisma.exercise.create({
      data: {
        id: newId(), version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: ['untouched'], publishedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/progress/concepts')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.concepts).toEqual([
      { concept: 'untouched', totalExercises: 1, passedExercises: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- test/progress/progress.controller.spec.ts
```

Expected: FAIL — `GET /api/progress/concepts` returns 404 (route missing).

- [ ] **Step 3: Add controller method**

Modify `platform/src/progress/progress.controller.ts` — add a new method and import `ConceptsProgress`:

Replace the existing import of the service types with:
```ts
import { ProgressAggregatorService, TrackProgress, ConceptsProgress } from './progress.service';
```

Then add inside the `ProgressController` class:

```ts
@Get('concepts')
@UseGuards(JwtAuthGuard)
async getConceptProgress(
  @CurrentUser() user: { userId: string },
): Promise<ConceptsProgress> {
  const student = await this.students.findByUserId(user.userId);
  const studentId = student?.id ?? '';
  return this.service.getConceptProgress(studentId);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- test/progress/progress.controller.spec.ts
```

Expected: all tracks + concepts e2e tests pass.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: no regressions anywhere.

- [ ] **Step 6: Commit**

```bash
git add src/progress/progress.controller.ts test/progress/progress.controller.spec.ts
git commit -m "feat(progress): add GET /api/progress/concepts"
```

**Platform side done. 🎉 Push the branch if you want a sanity CI run before starting the web side.**

---

## Task W0: Web branch

**Files:** none.

- [ ] **Step 1: Create web branch from master**

```bash
cd c:/Users/ricma/BootCamp/web
git fetch
git checkout master
git pull --ff-only
git checkout -b feat/progress-mastery
```

- [ ] **Step 2: Verify baseline tests pass**

```bash
npm test
```

Expected: all existing tests pass.

---

## Task W1: Progress fetch helpers (TDD)

**Files:**
- Create: `web/lib/progress.ts`
- Create: `web/tests/progress.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/tests/progress.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTrackProgress, fetchConceptProgress } from '@/lib/progress';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTrackProgress', () => {
  it('returns TrackProgress on 200', async () => {
    const mock = {
      trackId: 't1',
      lessons: [
        { lessonId: 'l1', lessonVersion: 1, totalExercises: 3, passedExercises: 1,
          attemptedExercises: 2, state: 'in_progress', lastAttemptAt: '2026-04-20T10:00:00Z' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await fetchTrackProgress('t1');

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/tracks/t1'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await fetchTrackProgress('missing');
    expect(result).toBeNull();
  });

  it('throws on other non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchTrackProgress('t1')).rejects.toThrow('track progress 500');
  });
});

describe('fetchConceptProgress', () => {
  it('returns ConceptsProgress on 200', async () => {
    const mock = {
      concepts: [
        { concept: 'functions', totalExercises: 10, passedExercises: 8 },
        { concept: 'strings', totalExercises: 5, passedExercises: 5 },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await fetchConceptProgress();

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/concepts'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchConceptProgress()).rejects.toThrow('concept progress 401');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd c:/Users/ricma/BootCamp/web
npm test -- tests/progress.test.ts
```

Expected: FAIL — module `@/lib/progress` not found.

- [ ] **Step 3: Implement the fetch helpers**

Create `web/lib/progress.ts`:

```ts
export type LessonProgressState = 'not_started' | 'in_progress' | 'complete';

export type LessonProgress = {
  lessonId: string;
  lessonVersion: number;
  totalExercises: number;
  passedExercises: number;
  attemptedExercises: number;
  state: LessonProgressState;
  lastAttemptAt: string | null;
};

export type TrackProgress = {
  trackId: string;
  lessons: LessonProgress[];
};

export type ConceptProgress = {
  concept: string;
  totalExercises: number;
  passedExercises: number;
};

export type ConceptsProgress = {
  concepts: ConceptProgress[];
};

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export async function fetchTrackProgress(trackId: string): Promise<TrackProgress | null> {
  const res = await fetch(`${BASE}/api/progress/tracks/${trackId}`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`track progress ${res.status}`);
  return res.json();
}

export async function fetchConceptProgress(): Promise<ConceptsProgress> {
  const res = await fetch(`${BASE}/api/progress/concepts`, { credentials: 'include' });
  if (!res.ok) throw new Error(`concept progress ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/progress.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/progress.ts tests/progress.test.ts
git commit -m "feat(web): add progress fetch helpers"
```

---

## Task W2: TimelineLessonNode component (TDD)

**Files:**
- Create: `web/components/tracks/TimelineLessonNode.tsx`
- Create: `web/tests/tracks/timeline.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `web/tests/tracks/timeline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineLessonNode } from '@/components/tracks/TimelineLessonNode';

const baseLesson = {
  id: 'l1',
  version: 1,
  title: 'Intro to Swift',
  level: 'beginner',
  summary: 'Get started',
  position: 0,
};

describe('TimelineLessonNode', () => {
  it('renders not_started as empty bordered circle with the lesson number', () => {
    render(
      <TimelineLessonNode
        lesson={baseLesson}
        index={0}
        isFirst
        isLast={false}
        state="not_started"
      />,
    );
    // Number shown inside the circle
    expect(screen.getByText('1')).toBeInTheDocument();
    // No check mark
    expect(screen.queryByLabelText('complete')).toBeNull();
  });

  it('renders in_progress as a half-filled ring with the lesson number', () => {
    const { container } = render(
      <TimelineLessonNode
        lesson={baseLesson}
        index={2}
        isFirst={false}
        isLast={false}
        state="in_progress"
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument(); // index+1
    // Progress ring svg is rendered
    expect(container.querySelector('svg[data-testid="progress-ring"]')).not.toBeNull();
  });

  it('renders complete as solid green circle with a check mark', () => {
    render(
      <TimelineLessonNode
        lesson={baseLesson}
        index={0}
        isFirst={false}
        isLast
        state="complete"
      />,
    );
    expect(screen.getByLabelText('complete')).toBeInTheDocument();
    // Number should NOT be visible in the circle when complete
    const numberSpans = screen.queryAllByText('1');
    expect(numberSpans.length).toBe(0);
  });

  it('defaults to not_started when state is undefined', () => {
    render(
      <TimelineLessonNode
        lesson={baseLesson}
        index={0}
        isFirst
        isLast={false}
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByLabelText('complete')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/tracks/timeline.test.tsx
```

Expected: FAIL — module `@/components/tracks/TimelineLessonNode` not found.

- [ ] **Step 3: Implement the component**

Create `web/components/tracks/TimelineLessonNode.tsx`:

```tsx
import Link from 'next/link';
import type { LessonSummary } from '@/lib/tracks';
import type { LessonProgressState } from '@/lib/progress';

const LEVEL_STYLES: Record<string, string> = {
  beginner: 'text-emerald-700 dark:text-emerald-400',
  intermediate: 'text-amber-700 dark:text-amber-400',
  advanced: 'text-rose-700 dark:text-rose-400',
};

function PlayIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="complete">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ProgressRing({ ratio }: { ratio: number }) {
  // Thin arc around the circle, clamped to [0, 1]
  const r = 15;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <svg
      data-testid="progress-ring"
      className="absolute -inset-0.5 h-[calc(100%+0.25rem)] w-[calc(100%+0.25rem)]"
      viewBox="0 0 34 34"
      aria-hidden="true"
    >
      <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
      <circle
        cx="17"
        cy="17"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${c * clamped} ${c * (1 - clamped)}`}
        strokeDashoffset={c * 0.25}
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  lesson: LessonSummary;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  state?: LessonProgressState;
  progressRatio?: number; // 0..1, only used when state === 'in_progress'
};

export function TimelineLessonNode({
  lesson,
  index,
  isFirst,
  isLast,
  state = 'not_started',
  progressRatio = 0,
}: Props) {
  const levelClass = LEVEL_STYLES[lesson.level] ?? 'text-gray-500 dark:text-gray-400';
  const isComplete = state === 'complete';
  const isInProgress = state === 'in_progress';

  const circleClass = isComplete
    ? 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 text-white transition group-hover:bg-emerald-400'
    : 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700 transition group-hover:border-blue-500 group-hover:bg-blue-50 group-hover:text-blue-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:group-hover:border-blue-500 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-400';

  return (
    <li className="relative">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[15px] top-8 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-800"
        />
      )}
      <Link
        href={`/lesson/${lesson.id}`}
        className="group relative flex gap-4 pb-6 last:pb-0"
      >
        <span className={circleClass}>
          {isInProgress && (
            <span className="absolute inset-0 text-blue-600 dark:text-blue-400">
              <ProgressRing ratio={progressRatio} />
            </span>
          )}
          {isComplete ? <CheckIcon /> : <span className="relative z-10">{index + 1}</span>}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
              {lesson.title}
            </h3>
            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider ${levelClass}`}>
              {lesson.level}
            </span>
            {isFirst && !isComplete && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                <PlayIcon /> Start here
              </span>
            )}
          </div>
          {lesson.summary && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {lesson.summary}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/tracks/timeline.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/tracks/TimelineLessonNode.tsx tests/tracks/timeline.test.tsx
git commit -m "feat(web): add TimelineLessonNode with state variants"
```

---

## Task W3: Wire track detail page with progress + smart button

**Files:**
- Modify: `web/lib/progress.ts` (add `smartTrackCta`)
- Create: `web/tests/tracks/smartCta.test.ts`
- Modify: `web/app/tracks/[id]/page.tsx`

The page currently has an inline `LessonNode` component; we'll replace it with `TimelineLessonNode`, fetch progress in parallel, and wire a context-aware CTA. Doing the CTA as a pure helper in `lib/progress.ts` first keeps the page thin and lets us unit-test the logic.

- [ ] **Step 1: Write failing tests for `smartTrackCta`**

Create `web/tests/tracks/smartCta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { smartTrackCta, type TrackProgress } from '@/lib/progress';

const lessons = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }];

describe('smartTrackCta', () => {
  it('returns null when track has no lessons', () => {
    expect(smartTrackCta([], null)).toBeNull();
  });

  it('returns "Start learning" when progress is null', () => {
    expect(smartTrackCta(lessons, null)).toEqual({ label: 'Start learning', lessonId: 'l1' });
  });

  it('returns "Start learning" when no lessons attempted', () => {
    const progress: TrackProgress = {
      trackId: 't1',
      lessons: lessons.map((l) => ({
        lessonId: l.id, lessonVersion: 1, totalExercises: 2, passedExercises: 0,
        attemptedExercises: 0, state: 'not_started', lastAttemptAt: null,
      })),
    };
    expect(smartTrackCta(lessons, progress)).toEqual({ label: 'Start learning', lessonId: 'l1' });
  });

  it('returns "Continue" with most-recent in-progress lesson', () => {
    const progress: TrackProgress = {
      trackId: 't1',
      lessons: [
        { lessonId: 'l1', lessonVersion: 1, totalExercises: 2, passedExercises: 2,
          attemptedExercises: 2, state: 'complete', lastAttemptAt: '2026-04-10T10:00:00Z' },
        { lessonId: 'l2', lessonVersion: 1, totalExercises: 2, passedExercises: 1,
          attemptedExercises: 2, state: 'in_progress', lastAttemptAt: '2026-04-15T10:00:00Z' },
        { lessonId: 'l3', lessonVersion: 1, totalExercises: 2, passedExercises: 0,
          attemptedExercises: 1, state: 'in_progress', lastAttemptAt: '2026-04-20T10:00:00Z' },
      ],
    };
    expect(smartTrackCta(lessons, progress)).toEqual({ label: 'Continue', lessonId: 'l3' });
  });

  it('returns "Review" when all lessons complete', () => {
    const progress: TrackProgress = {
      trackId: 't1',
      lessons: lessons.map((l) => ({
        lessonId: l.id, lessonVersion: 1, totalExercises: 2, passedExercises: 2,
        attemptedExercises: 2, state: 'complete', lastAttemptAt: '2026-04-20T10:00:00Z',
      })),
    };
    expect(smartTrackCta(lessons, progress)).toEqual({ label: 'Review', lessonId: 'l1' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/tracks/smartCta.test.ts
```

Expected: FAIL — `smartTrackCta` is not exported from `@/lib/progress`.

- [ ] **Step 3: Implement `smartTrackCta`**

Append to `web/lib/progress.ts`:

```ts
export function smartTrackCta(
  trackLessons: Array<{ id: string }>,
  progress: TrackProgress | null,
): { label: 'Start learning' | 'Continue' | 'Review'; lessonId: string } | null {
  const first = trackLessons[0];
  if (!first) return null;
  if (!progress || progress.lessons.length === 0) {
    return { label: 'Start learning', lessonId: first.id };
  }
  const inProgress = progress.lessons.filter((l) => l.state === 'in_progress');
  if (inProgress.length > 0) {
    const sorted = [...inProgress].sort((a, b) => {
      const ta = a.lastAttemptAt ? Date.parse(a.lastAttemptAt) : 0;
      const tb = b.lastAttemptAt ? Date.parse(b.lastAttemptAt) : 0;
      return tb - ta;
    });
    return { label: 'Continue', lessonId: sorted[0].lessonId };
  }
  const allComplete =
    progress.lessons.length === trackLessons.length &&
    progress.lessons.every((l) => l.state === 'complete');
  if (allComplete) return { label: 'Review', lessonId: first.id };
  return { label: 'Start learning', lessonId: first.id };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/tracks/smartCta.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Rewrite the track detail page to use progress + TimelineLessonNode**

Overwrite `web/app/tracks/[id]/page.tsx` with:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import {
  fetchTrackProgress,
  smartTrackCta,
  type TrackProgress,
  type LessonProgress,
} from '@/lib/progress';
import { TimelineLessonNode } from '@/components/tracks/TimelineLessonNode';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </span>
  );
}

function GitIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function TrackDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [progress, setProgress] = useState<TrackProgress | null>(null);
  const [status, setStatus] = useState<'loading' | 'not-found' | 'error' | 'ok'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchTrack(id),
      fetchTrackProgress(id).catch(() => null), // progress is best-effort
    ])
      .then(([t, p]) => {
        if (!t) setStatus('not-found');
        else {
          setTrack(t);
          setProgress(p);
          setStatus('ok');
        }
      })
      .catch((e: unknown) => {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load track');
      });
  }, [id]);

  const progressByLessonId = new Map<string, LessonProgress>();
  if (progress) for (const lp of progress.lessons) progressByLessonId.set(lp.lessonId, lp);
  const cta = track ? smartTrackCta(track.lessons, progress) : null;

  return (
    <AppShell title={track?.title ?? 'Track'}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        {status === 'loading' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading track...</p>
        )}

        {status === 'not-found' && (
          <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Track not found.{' '}
            <Link href="/tracks" className="text-blue-600 hover:underline dark:text-blue-400">
              Back to all tracks
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {track && status === 'ok' && (
          <>
            <nav className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              <Link href="/tracks" className="hover:underline">Tracks</Link>
              <span className="mx-1.5">/</span>
              <span>{track.title}</span>
            </nav>

            <header className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Label>{track.language}</Label>
                <Label>{track.kind}</Label>
                <span className="text-xs text-gray-400 dark:text-gray-500">v{track.version}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {track.title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {track.description}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {cta && (
                  <Link
                    href={`/lesson/${cta.lessonId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    <PlayIcon /> {cta.label}
                  </Link>
                )}
                {track.starterRepoUrl && (
                  <a
                    href={track.starterRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <GitIcon />
                    Clone starter repo
                  </a>
                )}
              </div>

              <div className="mt-5 flex items-center gap-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <span>{track.lessons.length} lessons</span>
                <span>·</span>
                <span className="capitalize">{track.kind}</span>
              </div>
            </header>

            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Learning path
              </h2>

              {track.lessons.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No lessons in this track yet.
                </p>
              ) : (
                <ol className="relative">
                  {track.lessons.map((lesson, i) => {
                    const lp = progressByLessonId.get(lesson.id);
                    const ratio =
                      lp && lp.totalExercises > 0 ? lp.passedExercises / lp.totalExercises : 0;
                    return (
                      <TimelineLessonNode
                        key={lesson.id}
                        lesson={lesson}
                        index={i}
                        isFirst={i === 0}
                        isLast={i === track.lessons.length - 1}
                        state={lp?.state}
                        progressRatio={ratio}
                      />
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Run the full web test suite**

```bash
npm test
```

Expected: all tests pass with no regressions (`smartCta.test.ts`, `timeline.test.tsx`, and `progress.test.ts` all green).

- [ ] **Step 7: Sanity-check the page visually**

```bash
cd c:/Users/ricma/BootCamp
./dev.ps1  # or however the combined stack starts; see README
```

Then open `http://localhost:3001/tracks/<some-track-id>` while logged in. Verify:
- Timeline renders with lesson numbers (not_started circles) when there's no progress
- Header button reads "Start learning" for a fresh student
- After passing one exercise in a lesson, the lesson circle shows an arc; button reads "Continue"
- After passing all exercises in every lesson, circles are solid green with checks and button reads "Review"

If the stack script doesn't exist, start platform + web individually and skip this step — the unit tests cover the logic.

- [ ] **Step 8: Commit**

```bash
git add app/tracks/[id]/page.tsx lib/progress.ts tests/tracks/smartCta.test.ts
git commit -m "feat(web): wire track detail timeline + smart CTA with progress"
```

---

## Task W4: "Continue learning" row on tracks list

**Files:**
- Modify: `web/lib/progress.ts` (add `pickContinuePrompt`)
- Create: `web/tests/tracks/continue.test.ts`
- Modify: `web/app/tracks/page.tsx`

- [ ] **Step 1: Write failing tests for `pickContinuePrompt`**

Create `web/tests/tracks/continue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickContinuePrompt, type TrackProgress } from '@/lib/progress';

const tracks = [
  { id: 'tA', title: 'Swift Fundamentals' },
  { id: 'tB', title: 'Kotlin Basics' },
];

function makeProgress(
  trackId: string,
  lesson: { lessonId: string; state: 'in_progress' | 'complete' | 'not_started'; lastAttemptAt: string | null },
): TrackProgress {
  return {
    trackId,
    lessons: [{
      lessonId: lesson.lessonId, lessonVersion: 1, totalExercises: 2,
      passedExercises: lesson.state === 'complete' ? 2 : 1,
      attemptedExercises: lesson.state === 'not_started' ? 0 : 2,
      state: lesson.state,
      lastAttemptAt: lesson.lastAttemptAt,
    }],
  };
}

describe('pickContinuePrompt', () => {
  it('returns null when no progress exists for any track', () => {
    const map = new Map<string, TrackProgress | null>([['tA', null], ['tB', null]]);
    expect(pickContinuePrompt(tracks, map)).toBeNull();
  });

  it('returns null when no lessons are in_progress', () => {
    const map = new Map<string, TrackProgress | null>([
      ['tA', makeProgress('tA', { lessonId: 'l1', state: 'complete', lastAttemptAt: '2026-04-01T10:00:00Z' })],
      ['tB', makeProgress('tB', { lessonId: 'l2', state: 'not_started', lastAttemptAt: null })],
    ]);
    expect(pickContinuePrompt(tracks, map)).toBeNull();
  });

  it('picks the most recently attempted in_progress lesson', () => {
    const map = new Map<string, TrackProgress | null>([
      ['tA', makeProgress('tA', { lessonId: 'l1', state: 'in_progress', lastAttemptAt: '2026-04-10T10:00:00Z' })],
      ['tB', makeProgress('tB', { lessonId: 'l2', state: 'in_progress', lastAttemptAt: '2026-04-20T10:00:00Z' })],
    ]);
    expect(pickContinuePrompt(tracks, map)).toEqual({
      trackId: 'tB', trackTitle: 'Kotlin Basics', lessonId: 'l2',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/tracks/continue.test.ts
```

Expected: FAIL — `pickContinuePrompt` is not exported from `@/lib/progress`.

- [ ] **Step 3: Implement `pickContinuePrompt`**

Append to `web/lib/progress.ts`:

```ts
type TrackLike = { id: string; title: string };

export type ContinuePrompt = {
  trackId: string;
  trackTitle: string;
  lessonId: string;
};

export function pickContinuePrompt(
  tracks: TrackLike[],
  progressByTrack: Map<string, TrackProgress | null>,
): ContinuePrompt | null {
  let best: { trackId: string; trackTitle: string; lessonId: string; when: number } | null = null;
  for (const t of tracks) {
    const p = progressByTrack.get(t.id);
    if (!p) continue;
    for (const l of p.lessons) {
      if (l.state !== 'in_progress' || !l.lastAttemptAt) continue;
      const when = Date.parse(l.lastAttemptAt);
      if (!best || when > best.when) {
        best = { trackId: t.id, trackTitle: t.title, lessonId: l.lessonId, when };
      }
    }
  }
  if (!best) return null;
  return { trackId: best.trackId, trackTitle: best.trackTitle, lessonId: best.lessonId };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/tracks/continue.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Rewrite the tracks list page**

Overwrite `web/app/tracks/page.tsx` with:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { fetchTracks, type TrackSummary } from '@/lib/tracks';
import {
  fetchTrackProgress,
  pickContinuePrompt,
  type TrackProgress,
  type ContinuePrompt,
} from '@/lib/progress';

const LANG_ACCENT: Record<string, string> = {
  swift: 'bg-orange-500',
  kotlin: 'bg-purple-500',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {children}
    </span>
  );
}

function ArrowRight() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<TrackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [continuePrompt, setContinuePrompt] = useState<ContinuePrompt | null>(null);

  useEffect(() => {
    fetchTracks()
      .then(async (list) => {
        setTracks(list);
        // Fetch progress for every track in parallel; tolerate failures
        const progressPairs = await Promise.all(
          list.map(async (t) => {
            try {
              const p = await fetchTrackProgress(t.id);
              return [t.id, p] as const;
            } catch {
              return [t.id, null] as const;
            }
          }),
        );
        const progressByTrack = new Map(progressPairs);
        setContinuePrompt(pickContinuePrompt(list, progressByTrack));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load tracks'));
  }, []);

  return (
    <AppShell title="Tracks">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Pick a track
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Short, focused lessons. Work through them in order or jump around.
          </p>
        </div>

        {continuePrompt && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Continue learning
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                {continuePrompt.trackTitle}
              </span>
              <Link
                href={`/lesson/${continuePrompt.lessonId}`}
                className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Continue →
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {!tracks && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading tracks...</p>
        )}

        {tracks && tracks.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No tracks available yet.</p>
        )}

        {tracks && tracks.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tracks.map((t) => {
              const accent = LANG_ACCENT[t.language] ?? 'bg-gray-500';
              return (
                <Link
                  key={t.id}
                  href={`/tracks/${t.id}`}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                >
                  <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Label>{t.language}</Label>
                        <Label>{t.kind}</Label>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                        {t.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                        {t.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t.lessonCount} {t.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-blue-600 opacity-0 transition group-hover:opacity-100 dark:text-blue-400">
                      Open <ArrowRight />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add app/tracks/page.tsx lib/progress.ts tests/tracks/continue.test.ts
git commit -m "feat(web): add Continue learning row on tracks list"
```

---

## Task W5: ConceptMastery component (TDD)

**Files:**
- Create: `web/components/dashboard/ConceptMastery.tsx`
- Create: `web/tests/dashboard/ConceptMastery.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `web/tests/dashboard/ConceptMastery.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConceptMastery } from '@/components/dashboard/ConceptMastery';

describe('ConceptMastery', () => {
  it('renders nothing when concepts array is empty', () => {
    const { container } = render(<ConceptMastery concepts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders each concept with its fraction', () => {
    render(
      <ConceptMastery
        concepts={[
          { concept: 'functions', totalExercises: 10, passedExercises: 8 },
          { concept: 'strings', totalExercises: 5, passedExercises: 5 },
        ]}
      />,
    );
    expect(screen.getByText('functions')).toBeInTheDocument();
    expect(screen.getByText('strings')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
  });

  it('shows check mark next to fully-complete concepts', () => {
    render(
      <ConceptMastery
        concepts={[
          { concept: 'strings', totalExercises: 5, passedExercises: 5 },
        ]}
      />,
    );
    expect(screen.getByLabelText('concept-complete')).toBeInTheDocument();
  });

  it('does not show check mark when concept is only partially complete', () => {
    render(
      <ConceptMastery
        concepts={[
          { concept: 'functions', totalExercises: 10, passedExercises: 9 },
        ]}
      />,
    );
    expect(screen.queryByLabelText('concept-complete')).toBeNull();
  });

  it('uses muted label style when passedExercises is 0', () => {
    render(
      <ConceptMastery
        concepts={[
          { concept: 'conditionals', totalExercises: 3, passedExercises: 0 },
        ]}
      />,
    );
    const label = screen.getByText('conditionals');
    expect(label.className).toMatch(/text-gray-4|text-gray-5/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- tests/dashboard/ConceptMastery.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `web/components/dashboard/ConceptMastery.tsx`:

```tsx
import type { ConceptProgress } from '@/lib/progress';

type Props = {
  concepts: ConceptProgress[];
};

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-green-600 dark:text-green-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="concept-complete"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ConceptMastery({ concepts }: Props) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Concepts
        </h2>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {concepts.map((c) => {
          const ratio = c.totalExercises > 0 ? c.passedExercises / c.totalExercises : 0;
          const isComplete = c.totalExercises > 0 && c.passedExercises === c.totalExercises;
          const isUntouched = c.passedExercises === 0;
          return (
            <li key={c.concept} className="flex items-center gap-4 px-4 py-2.5">
              <span
                className={
                  isUntouched
                    ? 'w-32 shrink-0 truncate text-xs font-medium text-gray-400 dark:text-gray-500'
                    : 'w-32 shrink-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-200'
                }
              >
                {c.concept}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full bg-green-500 dark:bg-green-600"
                  style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {c.passedExercises} / {c.totalExercises}
              </span>
              {isComplete && <CheckIcon />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- tests/dashboard/ConceptMastery.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ConceptMastery.tsx tests/dashboard/ConceptMastery.test.tsx
git commit -m "feat(web): add ConceptMastery panel component"
```

---

## Task W6: Wire ConceptMastery into dashboard

**Files:**
- Modify: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Update the dashboard to fetch and render concepts**

Overwrite `web/app/dashboard/page.tsx` with:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { BadgesGrid } from '@/components/dashboard/BadgesGrid';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { ConceptMastery } from '@/components/dashboard/ConceptMastery';
import { useAuth } from '@/components/layout/AuthProvider';
import { fetchDashboard, fetchLeaderboard, type DashboardData, type LeaderboardData } from '@/lib/gamification';
import { fetchConceptProgress, type ConceptsProgress } from '@/lib/progress';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [concepts, setConcepts] = useState<ConceptsProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    setError(null);
    Promise.all([
      fetchDashboard(),
      fetchLeaderboard(),
      fetchConceptProgress().catch(() => null),
    ])
      .then(([dash, lb, cp]) => {
        setDashboard(dash);
        setLeaderboard(lb);
        setConcepts(cp);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setFetching(false));
  }, [user]);

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {loading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        )}
        {!loading && !user && (
          <p className="text-sm text-gray-600 dark:text-gray-400">Sign in to see your dashboard</p>
        )}
        {!loading && user && fetching && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Fetching stats…</p>
        )}
        {!loading && user && error && (
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load dashboard: {error}</p>
        )}
        {!loading && user && dashboard && (
          <>
            <StatsCard
              streak={dashboard.streak}
              totalPoints={dashboard.totalPoints}
              rank={dashboard.rank}
            />
            {concepts && <ConceptMastery concepts={concepts.concepts} />}
            <BadgesGrid badges={dashboard.badges} />
            <LeaderboardTable
              entries={leaderboard?.entries ?? []}
              myStudentId={user.id}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Run the full web test suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 3: Sanity-check the dashboard visually**

Start platform + web, log in as a seeded student with some passing attempts, navigate to `/dashboard`:
- Concept Mastery panel appears between the stats tiles and the BadgesGrid
- Bars reflect the passed/total ratio
- Fully-complete concepts show a check mark
- Concepts with 0 passed are muted gray
- Zero-attempt student sees concepts still listed (each at `0 / N`); if no published exercises exist at all, the panel is hidden (returns `null`)

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(web): surface ConceptMastery panel on dashboard"
```

---

## Task W7: Full verification + completion hand-off

- [ ] **Step 1: Re-run both test suites and do a full web build**

```bash
cd c:/Users/ricma/BootCamp/platform && npm test && npm run build
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

All four commands must succeed. The web build step catches TypeScript errors vitest might miss.

- [ ] **Step 2: Exercise all three touchpoints end-to-end**

With a logged-in seeded student who has a mix of attempts:
1. Visit `/tracks` — confirm the "Continue learning" row renders and points to the most recently attempted in-progress lesson. Confirm it disappears if the student has no in-progress work.
2. Visit `/tracks/:id` — confirm timeline circles reflect per-lesson state (empty / arc / solid-check) and that the header CTA changes among "Start learning" / "Continue" / "Review".
3. Visit `/dashboard` — confirm the Concept Mastery panel appears between stats tiles and BadgesGrid, sorted by passed DESC then concept ASC.

- [ ] **Step 3: Push both branches**

```bash
cd c:/Users/ricma/BootCamp/platform
git push -u origin feat/progress-mastery

cd c:/Users/ricma/BootCamp/web
git push -u origin feat/progress-mastery
```

- [ ] **Step 4: Invoke the superpowers:finishing-a-development-branch skill**

It will walk through the merge / PR / cleanup decisions for two branches across two repos.
