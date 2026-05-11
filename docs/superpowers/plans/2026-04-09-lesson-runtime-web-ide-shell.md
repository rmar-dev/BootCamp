# Lesson Runtime / Web IDE Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-pane lesson page in a new Next.js 14 app that fetches a published lesson from a new Nest read controller and renders all five exercise types, with working client-side checks for the three deterministic types and disabled Run buttons for the two execution-required types.

**Architecture:** Standalone `web/` Next.js 14 App Router app at `c:/Users/ricma/BootCamp/web/` calls a new public read-only controller in the existing Nest API (`c:/Users/ricma/BootCamp/platform/`). One seeded "Hello BootCamp" lesson with one of every exercise type drives both manual testing and the contract test. Client-side `check.ts` provides answer comparison for `multiple_choice` / `fill_blank` / `predict_output`; `code` / `fix_bug` show disabled Run buttons.

**Tech Stack:** Backend (existing): NestJS 10, Prisma 5, PostgreSQL 16, Zod 3, Jest. Frontend (new): Next.js 14 (App Router), TypeScript 5, Tailwind CSS, `@monaco-editor/react`, `react-markdown`, Vitest, React Testing Library, Playwright.

**Spec corrections noted from code inspection:** spec field names are `payload.brokenCode` (not `buggyCode`), `payload.blanks[i].expected: string[]` (not `correct: string`), `payload.multiSelect` (not `allowMultiple`), `payload.questionMarkdown` (separate from `promptMarkdown` on the exercise). The plan uses the authoritative names from `platform/src/content/types/exercise-payload.types.ts`. The `fill_blank` template uses the convention `{{blankId}}` for placeholders — the existing schema does not enforce a format, so we lock this convention now.

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Verify clean tree on master and create feature branch**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
git status
git checkout master
git pull --ff-only
git checkout -b feat/lesson-runtime
```
Expected: clean working tree, new branch `feat/lesson-runtime` created from `master` at `ba1f333`.

---

## Task 1: LessonRepository — published-only read with blocks

**Files:**
- Modify: `platform/src/content/repositories/lesson.repository.ts`
- Test: `platform/test/lesson-repository.published-with-blocks.spec.ts`

The existing `findByVersionWithBlocks` does not filter on `publishedAt`. The spec #2 controller must never return draft content. Add a published-only variant that returns the lesson with blocks ordered by position, or `null` if not published.

- [ ] **Step 1: Write the failing test**

Create `platform/test/lesson-repository.published-with-blocks.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ContentModule } from '../src/content/content.module';
import { LessonRepository } from '../src/content/repositories/lesson.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDb } from './helpers/reset-db';
import { newId } from '../src/shared/ids';

describe('LessonRepository.findLatestPublishedWithBlocks', () => {
  let repo: LessonRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ContentModule],
    }).compile();
    repo = moduleRef.get(LessonRepository);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('returns null when no published version exists', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      trackId: newId(),
      position: 0,
      title: 't',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    expect(await repo.findLatestPublishedWithBlocks(id)).toBeNull();
  });

  it('returns the latest published version with blocks ordered by position', async () => {
    const id = newId();
    const blockA = newId();
    const blockB = newId();
    await repo.createDraft({
      id,
      trackId: newId(),
      position: 0,
      title: 't',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: blockA, position: 1, kind: 'explanation', explanationMarkdown: 'A' },
        { id: blockB, position: 0, kind: 'explanation', explanationMarkdown: 'B' },
      ],
    });
    await repo.publish(id, 1);

    const result = await repo.findLatestPublishedWithBlocks(id);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(1);
    expect(result!.blocks.map((b) => b.explanationMarkdown)).toEqual(['B', 'A']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson-repository.published-with-blocks -i`
Expected: FAIL with `repo.findLatestPublishedWithBlocks is not a function`.

- [ ] **Step 3: Implement the method**

Add to `platform/src/content/repositories/lesson.repository.ts` (after `findLatestPublished`):

```ts
async findLatestPublishedWithBlocks(
  id: string,
): Promise<LessonWithBlocks | null> {
  const latest = await this.prisma.lesson.findFirst({
    where: { id, publishedAt: { not: null } },
    orderBy: { version: 'desc' },
    include: { blocks: { orderBy: { position: 'asc' } } },
  });
  return latest;
}

async findPublishedByVersionWithBlocks(
  id: string,
  version: number,
): Promise<LessonWithBlocks | null> {
  const lesson = await this.prisma.lesson.findUnique({
    where: { id_version: { id, version } },
    include: { blocks: { orderBy: { position: 'asc' } } },
  });
  if (!lesson || lesson.publishedAt === null) return null;
  return lesson;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson-repository.published-with-blocks -i`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/src/content/repositories/lesson.repository.ts platform/test/lesson-repository.published-with-blocks.spec.ts
git commit -m "feat: add published-only lesson reads with blocks"
```

---

## Task 2: LessonAssembler service — build LessonResponse DTO

**Files:**
- Create: `platform/src/content/services/lesson-assembler.service.ts`
- Modify: `platform/src/content/content.module.ts`
- Test: `platform/test/lesson-assembler.service.spec.ts`

The controller's job is HTTP only. The DTO assembly (resolving each exercise block's `(exerciseId, exerciseVersion)` into a hydrated `ExerciseDTO` and shaping the `LessonResponse`) lives in a service so it's unit-testable without spinning up the HTTP layer.

- [ ] **Step 1: Write the failing test**

Create `platform/test/lesson-assembler.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ContentModule } from '../src/content/content.module';
import { LessonAssemblerService } from '../src/content/services/lesson-assembler.service';
import { LessonRepository } from '../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../src/content/repositories/exercise.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDb } from './helpers/reset-db';
import { newId } from '../src/shared/ids';

describe('LessonAssemblerService', () => {
  let assembler: LessonAssemblerService;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ContentModule],
    }).compile();
    assembler = moduleRef.get(LessonAssemblerService);
    lessons = moduleRef.get(LessonRepository);
    exercises = moduleRef.get(ExerciseRepository);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('returns null for unknown lesson', async () => {
    expect(await assembler.assembleLatest(newId())).toBeNull();
  });

  it('returns null for draft-only lesson', async () => {
    const id = newId();
    await lessons.createDraft({
      id, trackId: newId(), position: 0, title: 't',
      level: 'beginner', summary: 's', blocks: [],
    });
    expect(await assembler.assembleLatest(id)).toBeNull();
  });

  it('inlines exercise payloads into exercise blocks', async () => {
    const lessonId = newId();
    const exId = newId();
    const explainBlockId = newId();
    const exerciseBlockId = newId();

    await exercises.createDraft({
      id: exId,
      lessonId,
      promptMarkdown: 'Pick one',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'Which?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 100,
      hints: [],
      concepts: [],
    });
    await exercises.publish(exId, 1);

    await lessons.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'Hello',
      level: 'beginner',
      summary: 'first',
      blocks: [
        { id: explainBlockId, position: 0, kind: 'explanation', explanationMarkdown: '# Hi' },
        { id: exerciseBlockId, position: 1, kind: 'exercise', exerciseId: exId, exerciseVersion: 1 },
      ],
    });
    await lessons.publish(lessonId, 1);

    const result = await assembler.assembleLatest(lessonId);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(lessonId);
    expect(result!.version).toBe(1);
    expect(result!.title).toBe('Hello');
    expect(result!.blocks).toHaveLength(2);
    expect(result!.blocks[0]).toEqual({ kind: 'explanation', id: explainBlockId, markdown: '# Hi' });
    expect(result!.blocks[1].kind).toBe('exercise');
    if (result!.blocks[1].kind !== 'exercise') throw new Error('type narrow');
    expect(result!.blocks[1].id).toBe(exerciseBlockId);
    expect(result!.blocks[1].exercise.id).toBe(exId);
    expect(result!.blocks[1].exercise.type).toBe('multiple_choice');
    expect(result!.blocks[1].exercise.payload.type).toBe('multiple_choice');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson-assembler -i`
Expected: FAIL — module/service not found.

- [ ] **Step 3: Create the service and DTO types**

Create `platform/src/content/services/lesson-assembler.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { LessonRepository } from '../repositories/lesson.repository';
import { ExerciseRepository } from '../repositories/exercise.repository';
import { ExercisePayload } from '../types/exercise-payload.types';
import { ExerciseTypeValue } from '../types/exercise-type.enum';

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
};

export type LessonBlockDTO =
  | { kind: 'explanation'; id: string; markdown: string }
  | { kind: 'exercise'; id: string; exercise: ExerciseDTO };

export type LessonResponseDTO = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: LessonBlockDTO[];
};

@Injectable()
export class LessonAssemblerService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
  ) {}

  async assembleLatest(id: string): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) return null;
    return this.toResponse(lesson);
  }

  async assembleByVersion(
    id: string,
    version: number,
  ): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findPublishedByVersionWithBlocks(id, version);
    if (!lesson) return null;
    return this.toResponse(lesson);
  }

  private async toResponse(
    lesson: Awaited<ReturnType<LessonRepository['findLatestPublishedWithBlocks']>>,
  ): Promise<LessonResponseDTO> {
    if (!lesson) throw new Error('toResponse called with null');
    const blocks: LessonBlockDTO[] = [];
    for (const block of lesson.blocks) {
      if (block.kind === 'explanation') {
        blocks.push({
          kind: 'explanation',
          id: block.id,
          markdown: block.explanationMarkdown ?? '',
        });
      } else {
        if (!block.exerciseId || block.exerciseVersion == null) continue;
        const ex = await this.exercises.findByVersion(
          block.exerciseId,
          block.exerciseVersion,
        );
        if (!ex || ex.publishedAt === null) continue;
        blocks.push({
          kind: 'exercise',
          id: block.id,
          exercise: {
            id: ex.id,
            version: ex.version,
            type: ex.type as ExerciseTypeValue,
            promptMarkdown: ex.promptMarkdown,
            pointsMax: ex.pointsMax,
            payload: ex.payload as unknown as ExercisePayload,
          },
        });
      }
    }
    return {
      id: lesson.id,
      version: lesson.version,
      title: lesson.title,
      trackId: lesson.trackId,
      blocks,
    };
  }
}
```

Modify `platform/src/content/content.module.ts` — add `LessonAssemblerService` to providers and exports:

```ts
import { Module } from '@nestjs/common';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { ExerciseRepository } from './repositories/exercise.repository';
import { PublishService } from './services/publish.service';
import { LessonAssemblerService } from './services/lesson-assembler.service';

@Module({
  providers: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
  ],
  exports: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
  ],
})
export class ContentModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson-assembler -i`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/src/content/services/lesson-assembler.service.ts platform/src/content/content.module.ts platform/test/lesson-assembler.service.spec.ts
git commit -m "feat: add lesson-assembler service for response DTO"
```

---

## Task 3: LessonController — HTTP routes

**Files:**
- Create: `platform/src/content/lesson.controller.ts`
- Modify: `platform/src/content/content.module.ts`
- Test: `platform/test/lesson.controller.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `platform/test/lesson.controller.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LessonRepository } from '../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../src/content/repositories/exercise.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDb } from './helpers/reset-db';
import { newId } from '../src/shared/ids';

describe('LessonController (e2e)', () => {
  let app: INestApplication;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    lessons = moduleRef.get(LessonRepository);
    exercises = moduleRef.get(ExerciseRepository);
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedPublishedLesson() {
    const lessonId = newId();
    const exId = newId();
    await exercises.createDraft({
      id: exId,
      lessonId,
      promptMarkdown: 'Pick',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'Which?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 100, hints: [], concepts: [],
    });
    await exercises.publish(exId, 1);

    await lessons.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'L',
      level: 'beginner',
      summary: 's',
      blocks: [
        { id: newId(), position: 0, kind: 'exercise', exerciseId: exId, exerciseVersion: 1 },
      ],
    });
    await lessons.publish(lessonId, 1);
    return lessonId;
  }

  it('GET /api/lessons/:id returns published lesson', async () => {
    const lessonId = await seedPublishedLesson();
    const res = await request(app.getHttpServer()).get(`/api/lessons/${lessonId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(lessonId);
    expect(res.body.version).toBe(1);
    expect(res.body.blocks).toHaveLength(1);
    expect(res.body.blocks[0].kind).toBe('exercise');
    expect(res.body.blocks[0].exercise.type).toBe('multiple_choice');
  });

  it('GET /api/lessons/:id returns 404 when not published', async () => {
    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId, trackId: newId(), position: 0, title: 'L',
      level: 'beginner', summary: 's', blocks: [],
    });
    const res = await request(app.getHttpServer()).get(`/api/lessons/${lessonId}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('GET /api/lessons/:id returns 404 when not found', async () => {
    const res = await request(app.getHttpServer()).get(`/api/lessons/${newId()}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/lessons/:id/v/:version returns specific version', async () => {
    const lessonId = await seedPublishedLesson();
    const res = await request(app.getHttpServer()).get(`/api/lessons/${lessonId}/v/1`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
  });
});
```

If `supertest` isn't installed yet, install it:
```bash
cd c:/Users/ricma/BootCamp/platform && npm install --save-dev supertest @types/supertest
```
(Per `package.json` inspection, `@types/supertest` is already present; only install `supertest` if missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson.controller -i`
Expected: FAIL — controller not found / 404 on all routes.

- [ ] **Step 3: Implement the controller**

Create `platform/src/content/lesson.controller.ts`:

```ts
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import {
  LessonAssemblerService,
  LessonResponseDTO,
} from './services/lesson-assembler.service';

@Controller('api/lessons')
export class LessonController {
  constructor(private readonly assembler: LessonAssemblerService) {}

  @Get(':id')
  async getLatest(@Param('id') id: string): Promise<LessonResponseDTO> {
    const result = await this.assembler.assembleLatest(id);
    if (!result) {
      throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get(':id/v/:version')
  async getByVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<LessonResponseDTO> {
    const result = await this.assembler.assembleByVersion(id, version);
    if (!result) {
      throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    }
    return result;
  }
}
```

Modify `platform/src/content/content.module.ts` — add controller:

```ts
import { Module } from '@nestjs/common';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { ExerciseRepository } from './repositories/exercise.repository';
import { PublishService } from './services/publish.service';
import { LessonAssemblerService } from './services/lesson-assembler.service';
import { LessonController } from './lesson.controller';

@Module({
  controllers: [LessonController],
  providers: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
  ],
  exports: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
  ],
})
export class ContentModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd c:/Users/ricma/BootCamp/platform && npx jest lesson.controller -i`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add platform/src/content/lesson.controller.ts platform/src/content/content.module.ts platform/test/lesson.controller.e2e-spec.ts
git commit -m "feat: add public lesson read controller"
```

---

## Task 4: Enable CORS in main.ts for the web dev server

**Files:**
- Modify: `platform/src/main.ts`

- [ ] **Step 1: Update main.ts to enable CORS for localhost:3001**

Replace `platform/src/main.ts` with:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
    credentials: false,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 2: Run the existing test suite**

Run: `cd c:/Users/ricma/BootCamp/platform && npm test`
Expected: all tests still pass (no behavioral change to test paths).

- [ ] **Step 3: Commit**

```bash
git add platform/src/main.ts
git commit -m "feat: enable cors for web dev server"
```

---

## Task 5: Prisma seed — Hello BootCamp lesson

**Files:**
- Create: `platform/prisma/seed.ts`
- Create: `platform/prisma/seed-ids.ts`
- Modify: `platform/package.json`

We need deterministic UUIDs so the seed is idempotent across re-runs (an upsert by composite PK). Define them as constants in a small file shared between the seed and any future test that wants to find the seeded lesson.

- [ ] **Step 1: Create shared seed-ids file**

Create `platform/prisma/seed-ids.ts`:

```ts
// Stable UUIDs for the "Hello BootCamp" seed lesson.
// Re-running the seed must upsert these rows in place.
export const SEED_TRACK_ID       = '11111111-1111-4111-8111-111111111111';
export const SEED_LESSON_ID      = '22222222-2222-4222-8222-222222222222';
export const SEED_EX_MC_ID       = '33333333-3333-4333-8333-333333333301';
export const SEED_EX_FILL_ID     = '33333333-3333-4333-8333-333333333302';
export const SEED_EX_PREDICT_ID  = '33333333-3333-4333-8333-333333333303';
export const SEED_EX_CODE_ID     = '33333333-3333-4333-8333-333333333304';
export const SEED_EX_FIXBUG_ID   = '33333333-3333-4333-8333-333333333305';
export const SEED_BLOCK_INTRO_ID    = '44444444-4444-4444-8444-444444444401';
export const SEED_BLOCK_MC_ID       = '44444444-4444-4444-8444-444444444402';
export const SEED_BLOCK_VARIABLES_ID = '44444444-4444-4444-8444-444444444403';
export const SEED_BLOCK_FILL_ID     = '44444444-4444-4444-8444-444444444404';
export const SEED_BLOCK_PREDICT_ID  = '44444444-4444-4444-8444-444444444405';
export const SEED_BLOCK_CODE_ID     = '44444444-4444-4444-8444-444444444406';
export const SEED_BLOCK_FIXBUG_ID   = '44444444-4444-4444-8444-444444444407';
```

- [ ] **Step 2: Create the seed script**

Create `platform/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import {
  SEED_TRACK_ID, SEED_LESSON_ID,
  SEED_EX_MC_ID, SEED_EX_FILL_ID, SEED_EX_PREDICT_ID,
  SEED_EX_CODE_ID, SEED_EX_FIXBUG_ID,
  SEED_BLOCK_INTRO_ID, SEED_BLOCK_MC_ID, SEED_BLOCK_VARIABLES_ID,
  SEED_BLOCK_FILL_ID, SEED_BLOCK_PREDICT_ID, SEED_BLOCK_CODE_ID,
  SEED_BLOCK_FIXBUG_ID,
} from './seed-ids';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Hello BootCamp...');

  // ---- Exercises ----
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_MC_ID, version: 1 } },
    create: {
      id: SEED_EX_MC_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Answer the question below.',
      type: 'multiple_choice', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'Which language are you learning?',
        options: [
          { id: 'swift', text: 'Swift' },
          { id: 'kotlin', text: 'Kotlin' },
          { id: 'both', text: 'Both' },
          { id: 'neither', text: 'Neither' },
        ],
        correctOptionIds: ['swift', 'kotlin', 'both'],
        multiSelect: false,
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_FILL_ID, version: 1 } },
    create: {
      id: SEED_EX_FILL_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Fill in the variable name.',
      type: 'fill_blank', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'fill_blank',
        language: 'swift',
        template: 'let {{name}} = 42',
        blanks: [{ id: 'name', expected: ['x'] }],
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_PREDICT_ID, version: 1 } },
    create: {
      id: SEED_EX_PREDICT_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'What does this print?',
      type: 'predict_output', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'predict_output',
        displayedLanguage: 'swift',
        displayedCode: 'let a = 2\nlet b = 3\nprint(a + b)',
        expectedOutput: '5',
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_CODE_ID, version: 1 } },
    create: {
      id: SEED_EX_CODE_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Write a function that returns "hello".',
      type: 'code', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func greet() -> String {\n  // your code here\n}\n',
        testCode: 'assert(greet() == "hello")',
        testEntryPoint: 'greet',
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_FIXBUG_ID, version: 1 } },
    create: {
      id: SEED_EX_FIXBUG_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Fix the bug so the function returns the sum.',
      type: 'fix_bug', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'fix_bug',
        language: 'swift',
        brokenCode: 'func add(_ a: Int, _ b: Int) -> Int {\n  return a - b\n}\n',
        testCode: 'assert(add(2, 3) == 5)',
        testEntryPoint: 'add',
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  // ---- Lesson ----
  // Upsert lesson row first (without blocks), then re-create blocks idempotently.
  await prisma.lesson.upsert({
    where: { id_version: { id: SEED_LESSON_ID, version: 1 } },
    create: {
      id: SEED_LESSON_ID, version: 1, trackId: SEED_TRACK_ID, position: 0,
      title: 'Hello BootCamp',
      level: 'beginner',
      summary: 'A first taste of every exercise type.',
      blockIds: [
        SEED_BLOCK_INTRO_ID, SEED_BLOCK_MC_ID, SEED_BLOCK_VARIABLES_ID,
        SEED_BLOCK_FILL_ID, SEED_BLOCK_PREDICT_ID, SEED_BLOCK_CODE_ID,
        SEED_BLOCK_FIXBUG_ID,
      ],
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  await prisma.block.deleteMany({
    where: { lessonId: SEED_LESSON_ID, lessonVersion: 1 },
  });
  await prisma.block.createMany({
    data: [
      {
        id: SEED_BLOCK_INTRO_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 0, kind: 'explanation',
        explanationMarkdown:
          '# Welcome to BootCamp\n\nBootCamp is an internal training program that takes you from zero to a shipped Mini Peacock streaming app. This first lesson is a tour of every kind of exercise you will encounter. Click around and try them out.',
      },
      {
        id: SEED_BLOCK_MC_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 1, kind: 'exercise',
        exerciseId: SEED_EX_MC_ID, exerciseVersion: 1,
      },
      {
        id: SEED_BLOCK_VARIABLES_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 2, kind: 'explanation',
        explanationMarkdown:
          '## Variables\n\nA variable holds a value you can refer to by name. In Swift you declare one with `let` for a constant or `var` for a mutable binding.',
      },
      {
        id: SEED_BLOCK_FILL_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 3, kind: 'exercise',
        exerciseId: SEED_EX_FILL_ID, exerciseVersion: 1,
      },
      {
        id: SEED_BLOCK_PREDICT_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 4, kind: 'exercise',
        exerciseId: SEED_EX_PREDICT_ID, exerciseVersion: 1,
      },
      {
        id: SEED_BLOCK_CODE_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 5, kind: 'exercise',
        exerciseId: SEED_EX_CODE_ID, exerciseVersion: 1,
      },
      {
        id: SEED_BLOCK_FIXBUG_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 6, kind: 'exercise',
        exerciseId: SEED_EX_FIXBUG_ID, exerciseVersion: 1,
      },
    ],
  });

  // ---- Track ----
  await prisma.track.upsert({
    where: { id_version: { id: SEED_TRACK_ID, version: 1 } },
    create: {
      id: SEED_TRACK_ID, version: 1, title: 'Swift Fundamentals',
      language: 'swift', kind: 'fundamentals',
      description: 'The seed track that hosts Hello BootCamp.',
      lessonIds: [SEED_LESSON_ID], lessonVersions: [1],
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  console.log('Seed complete: lesson id =', SEED_LESSON_ID);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Wire seed into package.json**

Modify `platform/package.json`. Add this top-level key (alongside `scripts`):

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

And add this script entry:

```json
"seed": "ts-node prisma/seed.ts"
```

- [ ] **Step 4: Run the seed**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
docker compose up -d
sleep 3
npm run seed
```
Expected output ends with `Seed complete: lesson id = 22222222-2222-4222-8222-222222222222`.

- [ ] **Step 5: Verify against the live controller**

Run the Nest server in one terminal:
```bash
cd c:/Users/ricma/BootCamp/platform && npm run start
```
In another terminal:
```bash
curl http://localhost:3000/api/lessons/22222222-2222-4222-8222-222222222222 | head -c 500
```
Expected: JSON with `"title":"Hello BootCamp"` and 7 blocks. Stop the server (Ctrl-C).

- [ ] **Step 6: Re-run seed to verify idempotency**

Run: `cd c:/Users/ricma/BootCamp/platform && npm run seed`
Expected: completes without errors. No new rows created (re-running the script with deterministic ids upserts in place).

- [ ] **Step 7: Commit**

```bash
git add platform/prisma/seed.ts platform/prisma/seed-ids.ts platform/package.json
git commit -m "feat: add hello bootcamp seed lesson"
```

---

## Task 6: Bootstrap Next.js 14 web app

**Files:**
- Create: `web/` directory tree (Next.js scaffold)

- [ ] **Step 1: Scaffold the project**

Run from BootCamp root:
```bash
cd c:/Users/ricma/BootCamp
npx create-next-app@14 web --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack --no-git
```
When prompted for any other options, accept defaults.

- [ ] **Step 2: Verify it boots**

```bash
cd c:/Users/ricma/BootCamp/web
npm run dev -- -p 3001
```
Visit `http://localhost:3001` — expect the Next.js starter page. Stop the server.

- [ ] **Step 3: Set the dev port permanently**

Modify `web/package.json` `scripts.dev`:
```json
"dev": "next dev -p 3001",
```

- [ ] **Step 4: Configure Nest API base URL**

Create `web/.env.local`:
```
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp
# `web/` is outside the platform git repo by default; check if a separate web repo is desired.
# For spec #2 we add web/ as untracked under BootCamp root (matches docs/ pattern). No commit needed here unless a repo exists.
```

If `web/` ends up inside a git repo (e.g., a future BootCamp-root repo), the commit is:
```bash
git add web/
git commit -m "chore: bootstrap nextjs 14 web app"
```

---

## Task 7: Web — testing tooling (Vitest + RTL + Playwright)

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`
- Create: `web/vitest.setup.ts`
- Create: `web/playwright.config.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
cd c:/Users/ricma/BootCamp/web
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Vitest config**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Create `web/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Playwright config**

Create `web/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3001' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 4: Add npm scripts**

Modify `web/package.json` `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Smoke test the runners**

Create `web/tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run:
```bash
cd c:/Users/ricma/BootCamp/web && npm test
```
Expected: 1 PASS.

Delete the smoke test:
```bash
rm web/tests/smoke.test.ts
```

- [ ] **Step 6: Commit (if web is in a repo)**

---

## Task 8: Web — payload types, Zod copy, API client

**Files:**
- Create: `web/lib/exercise-payloads.ts`
- Create: `web/lib/exercise-payloads.zod.ts`
- Create: `web/lib/api.ts`
- Create: `web/tests/exercise-payloads.test.ts`

We hand-mirror spec #1's Zod schemas. The contract test in Task 14 keeps these in sync against the live API.

- [ ] **Step 1: Install Zod for the web app**

```bash
cd c:/Users/ricma/BootCamp/web && npm install zod
```

- [ ] **Step 2: Write the payload TS types**

Create `web/lib/exercise-payloads.ts`:

```ts
export type Language = 'swift' | 'kotlin';

export type CodePayload = {
  type: 'code';
  language: Language;
  starterCode: string;
  testCode: string;
  testEntryPoint: string;
};

export type FixBugPayload = {
  type: 'fix_bug';
  language: Language;
  brokenCode: string;
  testCode: string;
  testEntryPoint: string;
};

export type FillBlankItem = { id: string; expected: string[] };

export type FillBlankPayload = {
  type: 'fill_blank';
  language: Language;
  template: string;
  blanks: FillBlankItem[];
};

export type PredictOutputPayload = {
  type: 'predict_output';
  displayedCode: string;
  displayedLanguage: Language;
  expectedOutput: string;
};

export type MultipleChoiceOption = { id: string; text: string };

export type MultipleChoicePayload = {
  type: 'multiple_choice';
  questionMarkdown: string;
  options: MultipleChoiceOption[];
  correctOptionIds: string[];
  multiSelect: boolean;
};

export type ExercisePayload =
  | CodePayload
  | FixBugPayload
  | FillBlankPayload
  | PredictOutputPayload
  | MultipleChoicePayload;

export type ExerciseTypeValue = ExercisePayload['type'];

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
};

export type LessonBlock =
  | { kind: 'explanation'; id: string; markdown: string }
  | { kind: 'exercise'; id: string; exercise: ExerciseDTO };

export type Lesson = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: LessonBlock[];
};
```

- [ ] **Step 3: Write the Zod copy (used by contract test)**

Create `web/lib/exercise-payloads.zod.ts`:

```ts
import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']);

const code = z.object({
  type: z.literal('code'),
  language,
  starterCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fixBug = z.object({
  type: z.literal('fix_bug'),
  language,
  brokenCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fillBlank = z.object({
  type: z.literal('fill_blank'),
  language,
  template: z.string(),
  blanks: z
    .array(z.object({ id: z.string().min(1), expected: z.array(z.string()).min(1) }))
    .min(1),
});

const predictOutput = z.object({
  type: z.literal('predict_output'),
  displayedCode: z.string(),
  displayedLanguage: language,
  expectedOutput: z.string(),
});

const multipleChoice = z.object({
  type: z.literal('multiple_choice'),
  questionMarkdown: z.string().min(1),
  options: z
    .array(z.object({ id: z.string().min(1), text: z.string() }))
    .min(2),
  correctOptionIds: z.array(z.string()).min(1),
  multiSelect: z.boolean(),
});

export const exercisePayloadSchema = z.discriminatedUnion('type', [
  code, fixBug, fillBlank, predictOutput, multipleChoice,
]);

export const exerciseDtoSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  type: z.enum(['code', 'fix_bug', 'fill_blank', 'predict_output', 'multiple_choice']),
  promptMarkdown: z.string(),
  pointsMax: z.number().int(),
  payload: exercisePayloadSchema,
});

export const lessonBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('explanation'), id: z.string().min(1), markdown: z.string() }),
  z.object({ kind: z.literal('exercise'), id: z.string().min(1), exercise: exerciseDtoSchema }),
]);

export const lessonSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string(),
  trackId: z.string().nullable(),
  blocks: z.array(lessonBlockSchema),
});
```

- [ ] **Step 4: Write the API client**

Create `web/lib/api.ts`:

```ts
import type { Lesson } from './exercise-payloads';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export async function fetchLesson(id: string): Promise<Lesson | null> {
  const res = await fetch(`${BASE}/api/lessons/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchLesson ${id}: ${res.status}`);
  return (await res.json()) as Lesson;
}
```

- [ ] **Step 5: Sanity test that the Zod schema parses a hand-built lesson**

Create `web/tests/exercise-payloads.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lessonSchema } from '@/lib/exercise-payloads.zod';

describe('lessonSchema', () => {
  it('parses a minimal lesson', () => {
    const ok = lessonSchema.safeParse({
      id: 'a', version: 1, title: 't', trackId: null, blocks: [],
    });
    expect(ok.success).toBe(true);
  });

  it('parses each exercise type', () => {
    const ok = lessonSchema.safeParse({
      id: 'a', version: 1, title: 't', trackId: null,
      blocks: [
        { kind: 'explanation', id: 'b1', markdown: 'hi' },
        {
          kind: 'exercise', id: 'b2',
          exercise: {
            id: 'e1', version: 1, type: 'multiple_choice',
            promptMarkdown: 'p', pointsMax: 100,
            payload: {
              type: 'multiple_choice', questionMarkdown: 'q?',
              options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
              correctOptionIds: ['a'], multiSelect: false,
            },
          },
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: 2 PASS.

---

## Task 9: Web — pure check function

**Files:**
- Create: `web/lib/check.ts`
- Create: `web/tests/check.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/tests/check.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkAnswer } from '@/lib/check';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const mc = (multiSelect: boolean): ExerciseDTO => ({
  id: 'e', version: 1, type: 'multiple_choice', promptMarkdown: '', pointsMax: 100,
  payload: {
    type: 'multiple_choice', questionMarkdown: 'q',
    options: [
      { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
    ],
    correctOptionIds: multiSelect ? ['a', 'b'] : ['a'],
    multiSelect,
  },
});

const fill: ExerciseDTO = {
  id: 'e', version: 1, type: 'fill_blank', promptMarkdown: '', pointsMax: 100,
  payload: {
    type: 'fill_blank', language: 'swift', template: 'let {{n}} = 1',
    blanks: [{ id: 'n', expected: ['x', 'y'] }],
  },
};

const predict: ExerciseDTO = {
  id: 'e', version: 1, type: 'predict_output', promptMarkdown: '', pointsMax: 100,
  payload: {
    type: 'predict_output', displayedLanguage: 'swift',
    displayedCode: 'print(1)', expectedOutput: '1',
  },
};

describe('checkAnswer', () => {
  it('multiple_choice single-select pass', () => {
    expect(checkAnswer(mc(false), ['a'])).toEqual({ passed: true });
  });
  it('multiple_choice single-select fail', () => {
    expect(checkAnswer(mc(false), ['b'])).toEqual({ passed: false });
  });
  it('multiple_choice multi-select pass (set equality, order-insensitive)', () => {
    expect(checkAnswer(mc(true), ['b', 'a'])).toEqual({ passed: true });
  });
  it('multiple_choice multi-select fail when subset', () => {
    expect(checkAnswer(mc(true), ['a'])).toEqual({ passed: false });
  });

  it('fill_blank passes when answer matches any expected', () => {
    expect(checkAnswer(fill, { n: 'y' })).toEqual({ passed: true });
  });
  it('fill_blank trims whitespace', () => {
    expect(checkAnswer(fill, { n: '  x  ' })).toEqual({ passed: true });
  });
  it('fill_blank fails on wrong case (case-sensitive)', () => {
    expect(checkAnswer(fill, { n: 'X' })).toEqual({ passed: false });
  });
  it('fill_blank fails on missing blank', () => {
    expect(checkAnswer(fill, {})).toEqual({ passed: false });
  });

  it('predict_output passes on trimmed equality', () => {
    expect(checkAnswer(predict, '  1  ')).toEqual({ passed: true });
  });
  it('predict_output fails on wrong text', () => {
    expect(checkAnswer(predict, '2')).toEqual({ passed: false });
  });

  it('throws for code', () => {
    const ex: ExerciseDTO = {
      id: 'e', version: 1, type: 'code', promptMarkdown: '', pointsMax: 100,
      payload: {
        type: 'code', language: 'swift', starterCode: '',
        testCode: '', testEntryPoint: 'f',
      },
    };
    expect(() => checkAnswer(ex, '')).toThrow('execution backend not available');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: FAIL — `check.ts` does not exist.

- [ ] **Step 3: Implement check.ts**

Create `web/lib/check.ts`:

```ts
import type { ExerciseDTO } from './exercise-payloads';

export type CheckResult = { passed: boolean };

export function checkAnswer(exercise: ExerciseDTO, answer: unknown): CheckResult {
  switch (exercise.payload.type) {
    case 'multiple_choice': {
      const submitted = new Set((answer as string[]) ?? []);
      const correct = new Set(exercise.payload.correctOptionIds);
      if (submitted.size !== correct.size) return { passed: false };
      for (const id of submitted) if (!correct.has(id)) return { passed: false };
      return { passed: true };
    }
    case 'fill_blank': {
      const map = (answer as Record<string, string>) ?? {};
      for (const blank of exercise.payload.blanks) {
        const given = (map[blank.id] ?? '').trim();
        if (!blank.expected.includes(given)) return { passed: false };
      }
      return { passed: true };
    }
    case 'predict_output': {
      const given = String(answer ?? '').trim();
      return { passed: given === exercise.payload.expectedOutput.trim() };
    }
    case 'code':
    case 'fix_bug':
      throw new Error('execution backend not available');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: all check tests PASS.

---

## Task 10: MultipleChoiceExercise renderer

**Files:**
- Create: `web/components/lesson/renderers/MultipleChoiceExercise.tsx`
- Create: `web/tests/renderers/MultipleChoiceExercise.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/tests/renderers/MultipleChoiceExercise.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultipleChoiceExercise } from '@/components/lesson/renderers/MultipleChoiceExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'multiple_choice',
  promptMarkdown: 'Pick one', pointsMax: 100,
  payload: {
    type: 'multiple_choice', questionMarkdown: 'Which letter?',
    options: [{ id: 'a', text: 'Apple' }, { id: 'b', text: 'Banana' }],
    correctOptionIds: ['a'], multiSelect: false,
  },
};

describe('MultipleChoiceExercise', () => {
  it('renders the question and options', () => {
    render(<MultipleChoiceExercise exercise={ex} />);
    expect(screen.getByText('Which letter?')).toBeInTheDocument();
    expect(screen.getByLabelText('Apple')).toBeInTheDocument();
    expect(screen.getByLabelText('Banana')).toBeInTheDocument();
  });

  it('shows correct state when right answer is checked', async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByLabelText('Apple'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
  });

  it('shows incorrect state when wrong answer is checked', async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByLabelText('Banana'));
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- MultipleChoiceExercise`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

Create `web/components/lesson/renderers/MultipleChoiceExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { ExerciseDTO, MultipleChoicePayload } from '@/lib/exercise-payloads';
import { checkAnswer } from '@/lib/check';

export function MultipleChoiceExercise({ exercise }: { exercise: ExerciseDTO }) {
  const payload = exercise.payload as MultipleChoicePayload;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<null | { passed: boolean }>(null);

  function toggle(id: string) {
    setResult(null);
    if (payload.multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  }

  function onCheck() {
    setResult(checkAnswer(exercise, Array.from(selected)));
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">{payload.questionMarkdown}</p>
      <ul className="space-y-2">
        {payload.options.map((opt) => (
          <li key={opt.id}>
            <label className="flex items-center gap-2">
              <input
                type={payload.multiSelect ? 'checkbox' : 'radio'}
                name={`mc-${exercise.id}`}
                checked={selected.has(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        onClick={onCheck}
        disabled={selected.size === 0}
      >
        Check
      </button>
      {result && (
        <p className={result.passed ? 'text-green-600' : 'text-red-600'}>
          {result.passed ? 'Correct!' : 'Not quite — try again.'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- MultipleChoiceExercise`
Expected: 3 PASS.

---

## Task 11: FillBlankExercise renderer

**Files:**
- Create: `web/components/lesson/renderers/FillBlankExercise.tsx`
- Create: `web/tests/renderers/FillBlankExercise.test.tsx`

The `template` field uses `{{blankId}}` placeholders. The renderer splits the template on those tokens and inserts an `<input>` for each blank.

- [ ] **Step 1: Write the failing test**

Create `web/tests/renderers/FillBlankExercise.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FillBlankExercise } from '@/components/lesson/renderers/FillBlankExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'fill_blank',
  promptMarkdown: 'Fill it', pointsMax: 100,
  payload: {
    type: 'fill_blank', language: 'swift',
    template: 'let {{name}} = 42',
    blanks: [{ id: 'name', expected: ['x'] }],
  },
};

describe('FillBlankExercise', () => {
  it('renders the template with an input where the blank is', () => {
    render(<FillBlankExercise exercise={ex} />);
    expect(screen.getByText(/let/)).toBeInTheDocument();
    expect(screen.getByText(/= 42/)).toBeInTheDocument();
    expect(screen.getByLabelText('blank-name')).toBeInTheDocument();
  });

  it('passes on correct answer', async () => {
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.type(screen.getByLabelText('blank-name'), 'x');
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
  });

  it('fails on wrong answer', async () => {
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.type(screen.getByLabelText('blank-name'), 'wrong');
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- FillBlankExercise`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `web/components/lesson/renderers/FillBlankExercise.tsx`:

```tsx
'use client';
import { useState, Fragment } from 'react';
import type { ExerciseDTO, FillBlankPayload } from '@/lib/exercise-payloads';
import { checkAnswer } from '@/lib/check';

const TOKEN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

type Segment = { kind: 'text'; text: string } | { kind: 'blank'; id: string };

function tokenize(template: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of template.matchAll(TOKEN)) {
    const [whole, id] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ kind: 'text', text: template.slice(lastIndex, start) });
    segments.push({ kind: 'blank', id });
    lastIndex = start + whole.length;
  }
  if (lastIndex < template.length) segments.push({ kind: 'text', text: template.slice(lastIndex) });
  return segments;
}

export function FillBlankExercise({ exercise }: { exercise: ExerciseDTO }) {
  const payload = exercise.payload as FillBlankPayload;
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<null | { passed: boolean }>(null);
  const segments = tokenize(payload.template);

  function setValue(id: string, v: string) {
    setResult(null);
    setValues((prev) => ({ ...prev, [id]: v }));
  }

  return (
    <div className="space-y-4">
      <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-sm">
        {segments.map((s, i) =>
          s.kind === 'text' ? (
            <Fragment key={i}>{s.text}</Fragment>
          ) : (
            <input
              key={i}
              aria-label={`blank-${s.id}`}
              className="mx-1 inline-block w-24 rounded border border-gray-400 px-1"
              value={values[s.id] ?? ''}
              onChange={(e) => setValue(s.id, e.target.value)}
            />
          ),
        )}
      </pre>
      <button
        type="button"
        className="rounded bg-blue-600 px-4 py-2 text-white"
        onClick={() => setResult(checkAnswer(exercise, values))}
      >
        Check
      </button>
      {result && (
        <p className={result.passed ? 'text-green-600' : 'text-red-600'}>
          {result.passed ? 'Correct!' : 'Not quite — try again.'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- FillBlankExercise`
Expected: 3 PASS.

---

## Task 12: PredictOutputExercise renderer

**Files:**
- Create: `web/components/lesson/renderers/PredictOutputExercise.tsx`
- Create: `web/tests/renderers/PredictOutputExercise.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/tests/renderers/PredictOutputExercise.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PredictOutputExercise } from '@/components/lesson/renderers/PredictOutputExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'predict_output',
  promptMarkdown: 'What prints?', pointsMax: 100,
  payload: {
    type: 'predict_output', displayedLanguage: 'swift',
    displayedCode: 'print(2 + 3)', expectedOutput: '5',
  },
};

describe('PredictOutputExercise', () => {
  it('renders the displayed code', () => {
    render(<PredictOutputExercise exercise={ex} />);
    expect(screen.getByText('print(2 + 3)')).toBeInTheDocument();
  });

  it('passes on correct prediction', async () => {
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} />);
    await user.type(screen.getByLabelText(/predicted output/i), '5');
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
  });

  it('fails on wrong prediction', async () => {
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} />);
    await user.type(screen.getByLabelText(/predicted output/i), '6');
    await user.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- PredictOutputExercise`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `web/components/lesson/renderers/PredictOutputExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { ExerciseDTO, PredictOutputPayload } from '@/lib/exercise-payloads';
import { checkAnswer } from '@/lib/check';

export function PredictOutputExercise({ exercise }: { exercise: ExerciseDTO }) {
  const payload = exercise.payload as PredictOutputPayload;
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | { passed: boolean }>(null);

  return (
    <div className="space-y-4">
      <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-sm">
        {payload.displayedCode}
      </pre>
      <label className="block">
        <span className="text-sm font-medium">Predicted output</span>
        <textarea
          aria-label="predicted output"
          className="mt-1 block w-full rounded border border-gray-400 p-2 font-mono"
          rows={3}
          value={value}
          onChange={(e) => { setValue(e.target.value); setResult(null); }}
        />
      </label>
      <button
        type="button"
        className="rounded bg-blue-600 px-4 py-2 text-white"
        onClick={() => setResult(checkAnswer(exercise, value))}
      >
        Check
      </button>
      {result && (
        <p className={result.passed ? 'text-green-600' : 'text-red-600'}>
          {result.passed ? 'Correct!' : 'Not quite — try again.'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- PredictOutputExercise`
Expected: 3 PASS.

---

## Task 13: CodeExercise + FixBugExercise renderers (Monaco + disabled Run)

**Files:**
- Create: `web/components/lesson/renderers/CodeExercise.tsx`
- Create: `web/components/lesson/renderers/FixBugExercise.tsx`
- Create: `web/tests/renderers/CodeExercise.test.tsx`
- Create: `web/tests/renderers/FixBugExercise.test.tsx`

Monaco loads via `@monaco-editor/react`. In jsdom (Vitest) it doesn't render — we mock it for tests.

- [ ] **Step 1: Install Monaco**

```bash
cd c:/Users/ricma/BootCamp/web && npm install @monaco-editor/react
```

- [ ] **Step 2: Add a Monaco mock for Vitest**

Append to `web/vitest.setup.ts`:

```ts
import { vi } from 'vitest';
import React from 'react';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) =>
    React.createElement('textarea', {
      'data-testid': 'monaco',
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
    }),
}));
```

- [ ] **Step 3: Write the CodeExercise failing test**

Create `web/tests/renderers/CodeExercise.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeExercise } from '@/components/lesson/renderers/CodeExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'code',
  promptMarkdown: 'Greet', pointsMax: 100,
  payload: {
    type: 'code', language: 'swift',
    starterCode: 'func greet() -> String {}',
    testCode: '', testEntryPoint: 'greet',
  },
};

describe('CodeExercise', () => {
  it('renders Monaco prefilled with starterCode', () => {
    render(<CodeExercise exercise={ex} />);
    const editor = screen.getByTestId('monaco') as HTMLTextAreaElement;
    expect(editor.value).toBe('func greet() -> String {}');
  });

  it('renders a disabled Run button', () => {
    render(<CodeExercise exercise={ex} />);
    const button = screen.getByRole('button', { name: /run/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/spec #3/i));
  });
});
```

- [ ] **Step 4: Implement CodeExercise**

Create `web/components/lesson/renderers/CodeExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ExerciseDTO, CodePayload } from '@/lib/exercise-payloads';

export function CodeExercise({ exercise }: { exercise: ExerciseDTO }) {
  const payload = exercise.payload as CodePayload;
  const [code, setCode] = useState(payload.starterCode);

  return (
    <div className="space-y-4">
      <div className="h-72 rounded border border-gray-300">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          value={code}
          onChange={(v) => setCode(v ?? '')}
        />
      </div>
      <button
        type="button"
        className="rounded bg-gray-300 px-4 py-2 text-gray-600"
        disabled
        title="Execution backend coming in spec #3"
      >
        Run
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Write the FixBugExercise failing test**

Create `web/tests/renderers/FixBugExercise.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FixBugExercise } from '@/components/lesson/renderers/FixBugExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'fix_bug',
  promptMarkdown: 'Fix it', pointsMax: 100,
  payload: {
    type: 'fix_bug', language: 'swift',
    brokenCode: 'func add(_ a: Int, _ b: Int) -> Int { return a - b }',
    testCode: '', testEntryPoint: 'add',
  },
};

describe('FixBugExercise', () => {
  it('renders Monaco prefilled with brokenCode', () => {
    render(<FixBugExercise exercise={ex} />);
    const editor = screen.getByTestId('monaco') as HTMLTextAreaElement;
    expect(editor.value).toContain('return a - b');
  });

  it('renders a disabled Run button', () => {
    render(<FixBugExercise exercise={ex} />);
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });
});
```

- [ ] **Step 6: Implement FixBugExercise**

Create `web/components/lesson/renderers/FixBugExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import Editor from '@monaco-editor/react';
import type { ExerciseDTO, FixBugPayload } from '@/lib/exercise-payloads';

export function FixBugExercise({ exercise }: { exercise: ExerciseDTO }) {
  const payload = exercise.payload as FixBugPayload;
  const [code, setCode] = useState(payload.brokenCode);

  return (
    <div className="space-y-4">
      <div className="h-72 rounded border border-gray-300">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          value={code}
          onChange={(v) => setCode(v ?? '')}
        />
      </div>
      <button
        type="button"
        className="rounded bg-gray-300 px-4 py-2 text-gray-600"
        disabled
        title="Execution backend coming in spec #3"
      >
        Run
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Run tests**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: all renderer tests PASS.

---

## Task 14: ExerciseBlock dispatcher + ExplanationBlock + BlockList + lesson page

**Files:**
- Create: `web/components/lesson/ExerciseBlock.tsx`
- Create: `web/components/lesson/ExplanationBlock.tsx`
- Create: `web/components/lesson/BlockList.tsx`
- Create: `web/app/lesson/[id]/page.tsx`
- Create: `web/tests/renderers/ExerciseBlock.test.tsx`

- [ ] **Step 1: Install react-markdown**

```bash
cd c:/Users/ricma/BootCamp/web && npm install react-markdown remark-gfm
```

- [ ] **Step 2: Write a failing dispatcher test**

Create `web/tests/renderers/ExerciseBlock.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseBlock } from '@/components/lesson/ExerciseBlock';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

function make(type: ExerciseDTO['type']): ExerciseDTO {
  const base = { id: 'e', version: 1, type, promptMarkdown: 'p', pointsMax: 100 };
  switch (type) {
    case 'multiple_choice':
      return { ...base, payload: {
        type: 'multiple_choice', questionMarkdown: 'q?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'], multiSelect: false,
      } };
    case 'fill_blank':
      return { ...base, payload: {
        type: 'fill_blank', language: 'swift', template: 'x = {{n}}',
        blanks: [{ id: 'n', expected: ['1'] }],
      } };
    case 'predict_output':
      return { ...base, payload: {
        type: 'predict_output', displayedLanguage: 'swift',
        displayedCode: 'print(1)', expectedOutput: '1',
      } };
    case 'code':
      return { ...base, payload: {
        type: 'code', language: 'swift', starterCode: 's',
        testCode: '', testEntryPoint: 'f',
      } };
    case 'fix_bug':
      return { ...base, payload: {
        type: 'fix_bug', language: 'swift', brokenCode: 'b',
        testCode: '', testEntryPoint: 'f',
      } };
  }
}

describe('ExerciseBlock', () => {
  it('renders the matching renderer for each type', () => {
    const types: ExerciseDTO['type'][] = [
      'multiple_choice', 'fill_blank', 'predict_output', 'code', 'fix_bug',
    ];
    for (const t of types) {
      const { unmount } = render(<ExerciseBlock exercise={make(t)} />);
      // Each renderer surfaces a button labeled either Check or Run
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      unmount();
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd c:/Users/ricma/BootCamp/web && npm test -- ExerciseBlock`
Expected: FAIL.

- [ ] **Step 4: Implement ExerciseBlock dispatcher**

Create `web/components/lesson/ExerciseBlock.tsx`:

```tsx
'use client';
import type { ExerciseDTO } from '@/lib/exercise-payloads';
import { MultipleChoiceExercise } from './renderers/MultipleChoiceExercise';
import { FillBlankExercise } from './renderers/FillBlankExercise';
import { PredictOutputExercise } from './renderers/PredictOutputExercise';
import { CodeExercise } from './renderers/CodeExercise';
import { FixBugExercise } from './renderers/FixBugExercise';

export function ExerciseBlock({ exercise }: { exercise: ExerciseDTO }) {
  switch (exercise.type) {
    case 'multiple_choice': return <MultipleChoiceExercise exercise={exercise} />;
    case 'fill_blank':       return <FillBlankExercise      exercise={exercise} />;
    case 'predict_output':   return <PredictOutputExercise  exercise={exercise} />;
    case 'code':             return <CodeExercise           exercise={exercise} />;
    case 'fix_bug':          return <FixBugExercise         exercise={exercise} />;
  }
}
```

- [ ] **Step 5: Implement ExplanationBlock**

Create `web/components/lesson/ExplanationBlock.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ExplanationBlock({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 6: Implement BlockList (left pane)**

Create `web/components/lesson/BlockList.tsx`:

```tsx
import Link from 'next/link';
import type { Lesson } from '@/lib/exercise-payloads';
import { ExplanationBlock } from './ExplanationBlock';

export function BlockList({ lesson }: { lesson: Lesson }) {
  const exerciseBlocks = lesson.blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.kind === 'exercise');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lesson.title}</h1>
      {lesson.blocks.map((block, i) =>
        block.kind === 'explanation' ? (
          <ExplanationBlock key={block.id} markdown={block.markdown} />
        ) : (
          <div key={block.id} className="rounded border-l-4 border-blue-400 bg-blue-50 p-3">
            <Link href={`?ex=${i}`} className="text-blue-700 underline">
              Exercise: {block.exercise.promptMarkdown}
            </Link>
          </div>
        ),
      )}
      <hr className="my-4" />
      <nav aria-label="exercises" className="space-y-1">
        <p className="text-xs uppercase text-gray-500">Exercises in this lesson</p>
        {exerciseBlocks.map(({ b, i }) =>
          b.kind === 'exercise' ? (
            <Link
              key={b.id}
              href={`?ex=${i}`}
              className="block rounded px-2 py-1 text-sm hover:bg-gray-100"
            >
              {b.exercise.type}
            </Link>
          ) : null,
        )}
      </nav>
    </div>
  );
}
```

- [ ] **Step 7: Implement the lesson page**

Create `web/app/lesson/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { fetchLesson } from '@/lib/api';
import { BlockList } from '@/components/lesson/BlockList';
import { ExerciseBlock } from '@/components/lesson/ExerciseBlock';

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ex?: string };
}) {
  const lesson = await fetchLesson(params.id);
  if (!lesson) notFound();

  const exerciseIndices = lesson.blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.kind === 'exercise')
    .map(({ i }) => i);

  const requested = Number(searchParams.ex);
  const activeIndex =
    Number.isInteger(requested) && exerciseIndices.includes(requested)
      ? requested
      : exerciseIndices[0];

  const activeBlock = activeIndex !== undefined ? lesson.blocks[activeIndex] : undefined;

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[2fr_3fr]">
      <section className="overflow-y-auto border-r border-gray-200 p-6">
        <BlockList lesson={lesson} />
      </section>
      <section className="sticky top-0 h-screen overflow-y-auto p-6">
        {activeBlock && activeBlock.kind === 'exercise' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{activeBlock.exercise.promptMarkdown}</h2>
            <ExerciseBlock exercise={activeBlock.exercise} />
          </div>
        ) : (
          <p className="text-gray-500">Pick an exercise on the left.</p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Run all web tests**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: all suites PASS.

---

## Task 15: Contract test against the live Nest API

**Files:**
- Create: `web/tests/contract.test.ts`

Hits the running Nest server and asserts the seeded lesson parses against the web-side Zod schema. This catches type drift between spec #1 and `web/lib/exercise-payloads.ts`.

- [ ] **Step 1: Write the contract test**

Create `web/tests/contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { lessonSchema } from '@/lib/exercise-payloads.zod';

const SEED_LESSON_ID = '22222222-2222-4222-8222-222222222222';
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

describe('contract: live lesson API', () => {
  it('seeded lesson parses against web Zod schema', async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/lessons/${SEED_LESSON_ID}`);
    } catch (e) {
      throw new Error(
        `Could not reach ${BASE}. Start the platform server (npm run start) and run the seed (npm run seed) before running this test.`,
      );
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    const parsed = lessonSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Lesson contract drift: ' + JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
    expect(parsed.data.title).toBe('Hello BootCamp');
    expect(parsed.data.blocks).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run the contract test against a live server**

Start the platform server in one terminal:
```bash
cd c:/Users/ricma/BootCamp/platform && npm run seed && npm run start
```
In another terminal:
```bash
cd c:/Users/ricma/BootCamp/web && npm test -- contract
```
Expected: PASS.

If it fails with a parse error, the failure message lists the offending fields — fix the type/schema mismatch in `web/lib/exercise-payloads.ts` and `web/lib/exercise-payloads.zod.ts` before continuing.

Stop the platform server.

---

## Task 16: Playwright E2E smoke test

**Files:**
- Create: `web/tests/e2e/lesson.spec.ts`

- [ ] **Step 1: Write the smoke test**

Create `web/tests/e2e/lesson.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const SEED_LESSON_ID = '22222222-2222-4222-8222-222222222222';

test('renders Hello BootCamp lesson and answers a multiple choice', async ({ page }) => {
  await page.goto(`/lesson/${SEED_LESSON_ID}`);
  await expect(page.getByRole('heading', { name: 'Hello BootCamp' })).toBeVisible();

  // Sidebar lists each of the 5 exercise types
  const sidebar = page.getByRole('navigation', { name: 'exercises' });
  await expect(sidebar.getByText('multiple_choice')).toBeVisible();
  await expect(sidebar.getByText('fill_blank')).toBeVisible();
  await expect(sidebar.getByText('predict_output')).toBeVisible();
  await expect(sidebar.getByText('code')).toBeVisible();
  await expect(sidebar.getByText('fix_bug')).toBeVisible();

  // Default active exercise is the multiple choice — pick correct option and Check.
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /check/i }).click();
  await expect(page.getByText(/correct/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the test against a live stack**

Start everything (in 3 terminals):
```bash
# Terminal 1
cd c:/Users/ricma/BootCamp/platform && docker compose up -d && npm run seed && npm run start

# Terminal 2
cd c:/Users/ricma/BootCamp/web && npm run dev

# Terminal 3
cd c:/Users/ricma/BootCamp/web && npm run test:e2e
```
Expected: 1 PASS.

Stop the servers.

---

## Task 17: Final verification & commit

- [ ] **Step 1: Run the full backend test suite**

Run: `cd c:/Users/ricma/BootCamp/platform && npm test`
Expected: all spec #1 tests still pass plus the new lesson-repository, lesson-assembler, and lesson.controller tests.

- [ ] **Step 2: Run the full web unit suite**

Run: `cd c:/Users/ricma/BootCamp/web && npm test`
Expected: all `check`, renderer, dispatcher, and payload tests pass.

- [ ] **Step 3: Run the contract test against a live API** (Task 15 procedure).

- [ ] **Step 4: Run the Playwright E2E smoke** (Task 16 procedure).

- [ ] **Step 5: Commit any uncommitted backend work and tag the spec**

```bash
cd c:/Users/ricma/BootCamp/platform
git status
git log --oneline feat/lesson-runtime ^master
```
Expected: a clean working tree and a chain of commits implementing tasks 1–5.

- [ ] **Step 6: Update HANDOVER.md** (optional, follow spec #1's pattern) at `c:/Users/ricma/BootCamp/docs/superpowers/HANDOVER.md` with the new state: spec #2 complete, branch `feat/lesson-runtime`, list of new files, how to run both servers, and the next pickup prompt for spec #3.

---

## Out of scope reminders

- No auth, no sessions (spec #4)
- No persisted attempts (spec #5)
- No real code execution (spec #3)
- No track listing page (spec #4 or #9)
- No syntax highlighting in Monaco (deferred)
- No hint UI, no points display (specs #5/#6)
