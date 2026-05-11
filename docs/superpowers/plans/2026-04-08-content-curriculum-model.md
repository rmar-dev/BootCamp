# Content & Curriculum Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the content & curriculum data model for the BootCamp learning platform — a typed, version-aware persistence layer with validators, repositories, scoring, and an attempt-recording service. No HTTP routes, no UI, no auth. Consumed by future runtime/auth/grading specs as a library.

**Architecture:** A single NestJS application at `c:/Users/ricma/BootCamp/platform/` using Prisma over PostgreSQL. Two domain modules — `content` (Track, Lesson, Block, Exercise) and `state` (Student, Cohort, Enrollment, Attempt, ExerciseResult) — plus a shared `prisma` module. Exercise and submission payloads are stored as JSON columns and validated at the application boundary by Zod schemas. The scoring formula and progress queries are pure functions / read-only services so later specs can compose them. Versioning uses stable id + incrementing `version` int per the spec — every read of historical content goes through `(id, version)` lookups.

**Tech Stack:**
- TypeScript 5.x
- NestJS 10.x (modules, DI, testing)
- Prisma 5.x (schema, migrations, client)
- PostgreSQL 16 (Docker)
- Zod 3.x (payload validation)
- Jest (NestJS default — unit + integration)
- Node 20+

**Spec reference:** [`docs/superpowers/specs/2026-04-08-content-curriculum-model-design.md`](../specs/2026-04-08-content-curriculum-model-design.md)

---

## File Structure

```
platform/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── prisma/
│   ├── schema.prisma
│   └── migrations/                # generated
├── src/
│   ├── main.ts                    # Nest bootstrap (kept minimal)
│   ├── app.module.ts              # root module
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── content/
│   │   ├── content.module.ts
│   │   ├── types/
│   │   │   ├── exercise-type.enum.ts
│   │   │   ├── exercise-payload.types.ts
│   │   │   └── submission-payload.types.ts
│   │   ├── validators/
│   │   │   ├── exercise-payload.validator.ts
│   │   │   └── submission-payload.validator.ts
│   │   ├── repositories/
│   │   │   ├── track.repository.ts
│   │   │   ├── lesson.repository.ts
│   │   │   └── exercise.repository.ts
│   │   └── services/
│   │       └── publish.service.ts
│   ├── state/
│   │   ├── state.module.ts
│   │   ├── types/
│   │   │   └── scoring.types.ts
│   │   ├── repositories/
│   │   │   ├── student.repository.ts
│   │   │   ├── cohort.repository.ts
│   │   │   ├── enrollment.repository.ts
│   │   │   ├── attempt.repository.ts
│   │   │   └── exercise-result.repository.ts
│   │   └── services/
│   │       ├── scoring.service.ts
│   │       ├── attempt.service.ts
│   │       └── progress.service.ts
│   └── shared/
│       └── ids.ts                 # uuid generator wrapper
└── test/
    ├── jest-e2e.json
    ├── helpers/
    │   └── db.ts                  # test DB setup/teardown
    ├── content/
    │   ├── exercise-payload.validator.spec.ts
    │   ├── submission-payload.validator.spec.ts
    │   ├── track.repository.spec.ts
    │   ├── lesson.repository.spec.ts
    │   ├── exercise.repository.spec.ts
    │   └── publish.service.spec.ts
    ├── state/
    │   ├── scoring.service.spec.ts
    │   ├── attempt.service.spec.ts
    │   └── progress.service.spec.ts
    └── integration/
        └── full-flow.spec.ts
```

**Responsibility per file:**

- `prisma/schema.prisma` — single source of truth for database shape; mirrors the spec's 10 entities with version columns and JSON payload fields.
- `src/prisma/prisma.service.ts` — singleton Prisma client wrapper, lifecycle hooks for Nest.
- `src/content/types/*` — TypeScript types for exercise type enum, exercise payload discriminated union, submission payload discriminated union. No runtime code.
- `src/content/validators/*` — Zod schemas that parse `unknown` JSON into typed payloads. The boundary between "JSON in DB" and "typed objects in code."
- `src/content/repositories/*` — thin Prisma wrappers per content entity. Version-aware reads. No business logic beyond CRUD + lookup-by-version.
- `src/content/services/publish.service.ts` — the publish flow: takes a draft entity, mints a new version row, leaves old row intact.
- `src/state/types/scoring.types.ts` — input/output types for the scoring formula.
- `src/state/services/scoring.service.ts` — pure function implementing the spec's scoring formula. No DB access.
- `src/state/services/attempt.service.ts` — orchestrates an attempt: validate submission payload → run scoring → write Attempt → update ExerciseResult rollup. The model's main write entry point for student activity.
- `src/state/services/progress.service.ts` — derived state queries: lesson completion, track completion, "what lesson should this student see next."
- `test/integration/full-flow.spec.ts` — end-to-end test covering Success Criteria #1–#7 from the spec.

---

## Task 1: Project Bootstrap

**Files:**
- Create: `platform/package.json`
- Create: `platform/tsconfig.json`
- Create: `platform/nest-cli.json`
- Create: `platform/.gitignore`
- Create: `platform/src/main.ts`
- Create: `platform/src/app.module.ts`

- [ ] **Step 1: Create the platform directory and initialize a NestJS project**

Run:
```bash
mkdir -p c:/Users/ricma/BootCamp/platform
cd c:/Users/ricma/BootCamp/platform
npx -y @nestjs/cli@10 new . --package-manager npm --skip-git --strict
```

When prompted, accept defaults. This creates `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, and an initial test setup.

Expected: directory contains a working Nest skeleton. `npm run build` succeeds.

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm install @prisma/client@5 zod@3
npm install -D prisma@5 @types/node
```

Expected: `package.json` lists `@prisma/client`, `zod`, `prisma`, `@types/node`.

- [ ] **Step 3: Verify the bare app builds and tests run**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
npm test
```

Expected: build succeeds. Default `app.controller.spec.ts` test passes.

- [ ] **Step 4: Append a `.gitignore` entry for the local DB and env files**

Open `platform/.gitignore` (created by Nest CLI) and append:

```
.env
.env.local
postgres-data/
```

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git init
git add .
git commit -m "chore: bootstrap NestJS platform skeleton"
```

---

## Task 2: PostgreSQL via Docker + Environment

**Files:**
- Create: `platform/docker-compose.yml`
- Create: `platform/.env.example`
- Create: `platform/.env`

- [ ] **Step 1: Write docker-compose.yml**

Create `platform/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: bootcamp-postgres
    environment:
      POSTGRES_USER: bootcamp
      POSTGRES_PASSWORD: bootcamp
      POSTGRES_DB: bootcamp
    ports:
      - "5433:5432"
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
```

Port 5433 (not 5432) to avoid conflicting with any host Postgres.

- [ ] **Step 2: Write .env.example**

Create `platform/.env.example`:

```
DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public"
```

- [ ] **Step 3: Copy to .env for local development**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
cp .env.example .env
```

- [ ] **Step 4: Start the database**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
docker compose up -d
```

Expected: `bootcamp-postgres` container is running. Verify with `docker ps`.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add docker-compose.yml .env.example .gitignore
git commit -m "chore: add postgres docker compose and env template"
```

---

## Task 3: Prisma Schema for Content Entities

**Files:**
- Create: `platform/prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` with a default skeleton. Overwrite it in the next step.

- [ ] **Step 2: Write the full schema**

Replace the contents of `platform/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =====================
// Content half
// =====================

enum Language {
  swift
  kotlin
}

enum TrackKind {
  placement
  fundamentals
  capstone
}

enum LessonLevel {
  beginner
  intermediate
  advanced
}

enum BlockKind {
  explanation
  exercise
}

enum ExerciseType {
  code
  fix_bug
  fill_blank
  predict_output
  multiple_choice
}

model Track {
  id              String     @db.Uuid
  version         Int
  title           String
  language        Language
  kind            TrackKind
  description     String
  lessonIds       String[]   @db.Uuid
  lessonVersions  Int[]
  publishedAt     DateTime?

  @@id([id, version])
}

model Lesson {
  id                  String       @db.Uuid
  version             Int
  trackId             String       @db.Uuid
  position            Int
  title               String
  level               LessonLevel
  summary             String
  blockIds            String[]     @db.Uuid
  publishedAt         DateTime?

  blocks              Block[]

  @@id([id, version])
  @@index([trackId])
}

model Block {
  id                   String     @id @db.Uuid
  lessonId             String     @db.Uuid
  lessonVersion        Int
  position             Int
  kind                 BlockKind
  explanationMarkdown  String?
  exerciseId           String?    @db.Uuid
  exerciseVersion      Int?

  lesson               Lesson     @relation(fields: [lessonId, lessonVersion], references: [id, version])

  @@index([lessonId, lessonVersion])
}

model Exercise {
  id              String        @db.Uuid
  version         Int
  lessonId        String        @db.Uuid
  promptMarkdown  String
  type            ExerciseType
  payload         Json
  pointsMax       Int
  hints           String[]
  concepts        String[]
  publishedAt     DateTime?

  @@id([id, version])
}

// =====================
// State half
// =====================

enum EnrollmentStatus {
  active
  completed
  paused
}

model Student {
  id        String   @id @db.Uuid
  name      String
  email     String   @unique
  cohortId  String?  @db.Uuid
  createdAt DateTime @default(now())
}

model Cohort {
  id           String   @id @db.Uuid
  name         String
  instructorId String   @db.Uuid
  startDate    DateTime
}

model Enrollment {
  id                    String           @id @db.Uuid
  studentId             String           @db.Uuid
  trackId               String           @db.Uuid
  trackVersion          Int
  enrolledAt            DateTime         @default(now())
  assignedLevel         LessonLevel
  currentLessonId       String?          @db.Uuid
  currentLessonVersion  Int?
  status                EnrollmentStatus @default(active)

  @@unique([studentId, trackId])
  @@index([studentId])
}

model Attempt {
  id                    String   @id @db.Uuid
  studentId             String   @db.Uuid
  exerciseId            String   @db.Uuid
  exerciseVersion       Int
  submittedAt           DateTime @default(now())
  submissionPayload     Json
  passed                Boolean
  hintsUsedCount        Int
  failedAttemptsBefore  Int
  pointsAwarded         Int

  @@index([studentId, exerciseId])
}

model ExerciseResult {
  id              String    @id @db.Uuid
  studentId       String    @db.Uuid
  exerciseId      String    @db.Uuid
  bestAttemptId   String    @db.Uuid
  passed          Boolean
  pointsEarned    Int
  attemptsCount   Int
  firstPassedAt   DateTime?

  @@unique([studentId, exerciseId])
}
```

Notes:
- `Track`, `Lesson`, and `Exercise` use composite primary keys `(id, version)` per the spec.
- `Track.lessonIds` and `Track.lessonVersions` are parallel arrays — `lessonIds[i]` and `lessonVersions[i]` together pin one specific (lesson id, lesson version) reference. The repository validates they have equal length on every write.
- `Block` uses a single uuid primary key because it isn't versioned independently — its identity belongs to the lesson version that owns it.
- `ExerciseResult` has a unique `(studentId, exerciseId)` constraint enforcing one rollup row per student/exercise.

- [ ] **Step 3: Generate the first migration**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx prisma migrate dev --name init
```

Expected: a `prisma/migrations/<timestamp>_init/migration.sql` file is created and applied. Prisma client is generated. No errors.

- [ ] **Step 4: Verify the database has the tables**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
docker exec -it bootcamp-postgres psql -U bootcamp -d bootcamp -c "\dt"
```

Expected output includes: `Track`, `Lesson`, `Block`, `Exercise`, `Student`, `Cohort`, `Enrollment`, `Attempt`, `ExerciseResult`.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add prisma/
git commit -m "feat: initial prisma schema and migration for content and state entities"
```

---

## Task 4: Prisma Module + Service

**Files:**
- Create: `platform/src/prisma/prisma.service.ts`
- Create: `platform/src/prisma/prisma.module.ts`
- Modify: `platform/src/app.module.ts`

- [ ] **Step 1: Write the PrismaService**

Create `platform/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Write the PrismaModule**

Create `platform/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` so other modules don't need to import it explicitly.

- [ ] **Step 3: Wire it into the root module**

Replace the contents of `platform/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 4: Verify build still passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/prisma/ src/app.module.ts
git commit -m "feat: add global PrismaModule"
```

---

## Task 5: Shared `ids` Helper

**Files:**
- Create: `platform/src/shared/ids.ts`

This is a tiny module to centralize uuid generation so tests can mock it later if needed.

- [ ] **Step 1: Install uuid**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm install uuid@9
npm install -D @types/uuid
```

- [ ] **Step 2: Write the helper**

Create `platform/src/shared/ids.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';

export function newId(): string {
  return uuidv4();
}
```

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/shared/ package.json package-lock.json
git commit -m "feat: add shared id generator"
```

---

## Task 6: Exercise Type Enum and Payload Types

**Files:**
- Create: `platform/src/content/types/exercise-type.enum.ts`
- Create: `platform/src/content/types/exercise-payload.types.ts`
- Create: `platform/src/content/types/submission-payload.types.ts`

These are pure TypeScript types. No tests yet — types are validated by their consumers (Task 7's validator).

- [ ] **Step 1: Write the enum**

Create `platform/src/content/types/exercise-type.enum.ts`:

```typescript
export const ExerciseTypeValues = [
  'code',
  'fix_bug',
  'fill_blank',
  'predict_output',
  'multiple_choice',
] as const;

export type ExerciseTypeValue = (typeof ExerciseTypeValues)[number];
```

We define our own const array (not Prisma's enum) so Zod can use it directly.

- [ ] **Step 2: Write the exercise payload discriminated union**

Create `platform/src/content/types/exercise-payload.types.ts`:

```typescript
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

export type FillBlankItem = {
  id: string;
  expected: string[];
};

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

export type MultipleChoiceOption = {
  id: string;
  text: string;
};

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
```

The `type` discriminator on each variant matches the `Exercise.type` column, so a single discriminated union covers all five.

- [ ] **Step 3: Write the submission payload discriminated union**

Create `platform/src/content/types/submission-payload.types.ts`:

```typescript
export type CodeSubmission = {
  type: 'code';
  code: string;
};

export type FixBugSubmission = {
  type: 'fix_bug';
  code: string;
};

export type FillBlankSubmission = {
  type: 'fill_blank';
  blanks: Record<string, string>;
};

export type PredictOutputSubmission = {
  type: 'predict_output';
  answer: string;
};

export type MultipleChoiceSubmission = {
  type: 'multiple_choice';
  selectedOptionIds: string[];
};

export type SubmissionPayload =
  | CodeSubmission
  | FixBugSubmission
  | FillBlankSubmission
  | PredictOutputSubmission
  | MultipleChoiceSubmission;
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/types/
git commit -m "feat: add exercise type enum and payload type definitions"
```

---

## Task 7: Exercise Payload Validator (Zod)

**Files:**
- Create: `platform/src/content/validators/exercise-payload.validator.ts`
- Create: `platform/test/content/exercise-payload.validator.spec.ts`

This is the boundary between "Json column from Prisma" and "typed payload object."

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/exercise-payload.validator.spec.ts`:

```typescript
import { parseExercisePayload } from '../../src/content/validators/exercise-payload.validator';

describe('parseExercisePayload', () => {
  describe('code', () => {
    it('parses a valid code payload', () => {
      const raw = {
        type: 'code',
        language: 'swift',
        starterCode: 'func hello() {}',
        testCode: 'assert(hello() == nil)',
        testEntryPoint: 'runTests',
      };
      const result = parseExercisePayload('code', raw);
      expect(result.type).toBe('code');
      if (result.type === 'code') {
        expect(result.language).toBe('swift');
      }
    });

    it('rejects a code payload with the wrong type discriminator', () => {
      const raw = {
        type: 'fix_bug',
        language: 'swift',
        starterCode: '',
        testCode: '',
        testEntryPoint: 'runTests',
      };
      expect(() => parseExercisePayload('code', raw)).toThrow();
    });

    it('rejects a code payload missing testEntryPoint', () => {
      const raw = {
        type: 'code',
        language: 'swift',
        starterCode: '',
        testCode: '',
      };
      expect(() => parseExercisePayload('code', raw)).toThrow();
    });
  });

  describe('multiple_choice', () => {
    it('parses a valid multiple choice payload', () => {
      const raw = {
        type: 'multiple_choice',
        questionMarkdown: 'What is 2+2?',
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '4' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      };
      const result = parseExercisePayload('multiple_choice', raw);
      expect(result.type).toBe('multiple_choice');
      if (result.type === 'multiple_choice') {
        expect(result.correctOptionIds).toEqual(['b']);
      }
    });

    it('rejects a multiple choice payload whose correctOptionIds reference unknown options', () => {
      const raw = {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [{ id: 'a', text: '3' }],
        correctOptionIds: ['z'],
        multiSelect: false,
      };
      expect(() => parseExercisePayload('multiple_choice', raw)).toThrow(/correctOptionIds/);
    });
  });

  describe('fill_blank', () => {
    it('parses a valid fill_blank payload', () => {
      const raw = {
        type: 'fill_blank',
        language: 'kotlin',
        template: 'val x = ___',
        blanks: [{ id: 'blank_1', expected: ['1', '1L'] }],
      };
      const result = parseExercisePayload('fill_blank', raw);
      expect(result.type).toBe('fill_blank');
    });

    it('rejects fill_blank with no blanks', () => {
      const raw = {
        type: 'fill_blank',
        language: 'kotlin',
        template: 'no blanks here',
        blanks: [],
      };
      expect(() => parseExercisePayload('fill_blank', raw)).toThrow();
    });
  });

  describe('predict_output', () => {
    it('parses a valid predict_output payload', () => {
      const raw = {
        type: 'predict_output',
        displayedCode: 'print(1+1)',
        displayedLanguage: 'swift',
        expectedOutput: '2',
      };
      const result = parseExercisePayload('predict_output', raw);
      expect(result.type).toBe('predict_output');
    });
  });

  describe('fix_bug', () => {
    it('parses a valid fix_bug payload', () => {
      const raw = {
        type: 'fix_bug',
        language: 'swift',
        brokenCode: 'let x = ',
        testCode: 'assert(x == 1)',
        testEntryPoint: 'runTests',
      };
      const result = parseExercisePayload('fix_bug', raw);
      expect(result.type).toBe('fix_bug');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/exercise-payload.validator.spec.ts
```

Expected: FAIL — `Cannot find module '../../src/content/validators/exercise-payload.validator'`.

- [ ] **Step 3: Implement the validator**

Create `platform/src/content/validators/exercise-payload.validator.ts`:

```typescript
import { z } from 'zod';
import {
  ExercisePayload,
} from '../types/exercise-payload.types';
import { ExerciseTypeValue } from '../types/exercise-type.enum';

const languageSchema = z.enum(['swift', 'kotlin']);

const codeSchema = z.object({
  type: z.literal('code'),
  language: languageSchema,
  starterCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fixBugSchema = z.object({
  type: z.literal('fix_bug'),
  language: languageSchema,
  brokenCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fillBlankSchema = z.object({
  type: z.literal('fill_blank'),
  language: languageSchema,
  template: z.string(),
  blanks: z
    .array(
      z.object({
        id: z.string().min(1),
        expected: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});

const predictOutputSchema = z.object({
  type: z.literal('predict_output'),
  displayedCode: z.string(),
  displayedLanguage: languageSchema,
  expectedOutput: z.string(),
});

const multipleChoiceSchema = z
  .object({
    type: z.literal('multiple_choice'),
    questionMarkdown: z.string().min(1),
    options: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string(),
        }),
      )
      .min(2),
    correctOptionIds: z.array(z.string()).min(1),
    multiSelect: z.boolean(),
  })
  .refine(
    (val) => {
      const optionIds = new Set(val.options.map((o) => o.id));
      return val.correctOptionIds.every((id) => optionIds.has(id));
    },
    { message: 'correctOptionIds must reference existing option ids' },
  );

const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSchema,
  fix_bug: fixBugSchema,
  fill_blank: fillBlankSchema,
  predict_output: predictOutputSchema,
  multiple_choice: multipleChoiceSchema,
};

export function parseExercisePayload(
  type: ExerciseTypeValue,
  raw: unknown,
): ExercisePayload {
  const schema = schemaByType[type];
  return schema.parse(raw) as ExercisePayload;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/exercise-payload.validator.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/validators/exercise-payload.validator.ts test/content/exercise-payload.validator.spec.ts package.json package-lock.json
git commit -m "feat: add zod validator for exercise payloads"
```

---

## Task 8: Submission Payload Validator

**Files:**
- Create: `platform/src/content/validators/submission-payload.validator.ts`
- Create: `platform/test/content/submission-payload.validator.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/submission-payload.validator.spec.ts`:

```typescript
import { parseSubmissionPayload } from '../../src/content/validators/submission-payload.validator';

describe('parseSubmissionPayload', () => {
  it('parses a code submission', () => {
    const result = parseSubmissionPayload('code', { type: 'code', code: 'let x = 1' });
    expect(result.type).toBe('code');
  });

  it('parses a fix_bug submission', () => {
    const result = parseSubmissionPayload('fix_bug', { type: 'fix_bug', code: 'let x = 1' });
    expect(result.type).toBe('fix_bug');
  });

  it('parses a fill_blank submission', () => {
    const result = parseSubmissionPayload('fill_blank', {
      type: 'fill_blank',
      blanks: { blank_1: 'foo' },
    });
    expect(result.type).toBe('fill_blank');
  });

  it('parses a predict_output submission', () => {
    const result = parseSubmissionPayload('predict_output', {
      type: 'predict_output',
      answer: '42',
    });
    expect(result.type).toBe('predict_output');
  });

  it('parses a multiple_choice submission', () => {
    const result = parseSubmissionPayload('multiple_choice', {
      type: 'multiple_choice',
      selectedOptionIds: ['a', 'b'],
    });
    expect(result.type).toBe('multiple_choice');
  });

  it('rejects a submission with mismatched type discriminator', () => {
    expect(() =>
      parseSubmissionPayload('code', { type: 'fix_bug', code: 'x' }),
    ).toThrow();
  });

  it('rejects a code submission missing the code field', () => {
    expect(() => parseSubmissionPayload('code', { type: 'code' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/submission-payload.validator.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

Create `platform/src/content/validators/submission-payload.validator.ts`:

```typescript
import { z } from 'zod';
import { ExerciseTypeValue } from '../types/exercise-type.enum';
import { SubmissionPayload } from '../types/submission-payload.types';

const codeSubmissionSchema = z.object({
  type: z.literal('code'),
  code: z.string(),
});

const fixBugSubmissionSchema = z.object({
  type: z.literal('fix_bug'),
  code: z.string(),
});

const fillBlankSubmissionSchema = z.object({
  type: z.literal('fill_blank'),
  blanks: z.record(z.string(), z.string()),
});

const predictOutputSubmissionSchema = z.object({
  type: z.literal('predict_output'),
  answer: z.string(),
});

const multipleChoiceSubmissionSchema = z.object({
  type: z.literal('multiple_choice'),
  selectedOptionIds: z.array(z.string()),
});

const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSubmissionSchema,
  fix_bug: fixBugSubmissionSchema,
  fill_blank: fillBlankSubmissionSchema,
  predict_output: predictOutputSubmissionSchema,
  multiple_choice: multipleChoiceSubmissionSchema,
};

export function parseSubmissionPayload(
  type: ExerciseTypeValue,
  raw: unknown,
): SubmissionPayload {
  return schemaByType[type].parse(raw) as SubmissionPayload;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/submission-payload.validator.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/validators/submission-payload.validator.ts test/content/submission-payload.validator.spec.ts
git commit -m "feat: add zod validator for submission payloads"
```

---

## Task 9: Scoring Service (Pure Function)

**Files:**
- Create: `platform/src/state/types/scoring.types.ts`
- Create: `platform/src/state/services/scoring.service.ts`
- Create: `platform/test/state/scoring.service.spec.ts`

The scoring formula from the spec, isolated as a pure function so other services can call it without DB access.

- [ ] **Step 1: Write the failing test**

Create `platform/test/state/scoring.service.spec.ts`:

```typescript
import { ScoringService } from '../../src/state/services/scoring.service';

describe('ScoringService.computePoints', () => {
  const svc = new ScoringService();

  it('returns 0 for failed submissions regardless of inputs', () => {
    expect(
      svc.computePoints({
        passed: false,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
      }),
    ).toBe(0);
  });

  it('returns full points for a clean first-try pass', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
      }),
    ).toBe(100);
  });

  it('subtracts 10 percent of pointsMax per hint used', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 2,
        failedAttemptsBefore: 0,
      }),
    ).toBe(80);
  });

  it('subtracts 5 percent of pointsMax per failed prior attempt', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 0,
        failedAttemptsBefore: 3,
      }),
    ).toBe(85);
  });

  it('combines hint and failed-attempt penalties', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 1,
        failedAttemptsBefore: 2,
      }),
    ).toBe(80);
  });

  it('floors at 20 percent of pointsMax', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 100,
        hintsUsedCount: 10,
        failedAttemptsBefore: 10,
      }),
    ).toBe(20);
  });

  it('rounds down to integer points', () => {
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 50,
        hintsUsedCount: 1,
        failedAttemptsBefore: 0,
      }),
    ).toBe(45);
  });

  it('handles a non-multiple-of-10 pointsMax with proper flooring', () => {
    // 33 - (1 * 0.10 * 33) = 33 - 3.3 = 29.7 → 29
    expect(
      svc.computePoints({
        passed: true,
        pointsMax: 33,
        hintsUsedCount: 1,
        failedAttemptsBefore: 0,
      }),
    ).toBe(29);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/scoring.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the scoring types**

Create `platform/src/state/types/scoring.types.ts`:

```typescript
export type ScoringInput = {
  passed: boolean;
  pointsMax: number;
  hintsUsedCount: number;
  failedAttemptsBefore: number;
};
```

- [ ] **Step 4: Implement the scoring service**

Create `platform/src/state/services/scoring.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ScoringInput } from '../types/scoring.types';

@Injectable()
export class ScoringService {
  computePoints(input: ScoringInput): number {
    if (!input.passed) {
      return 0;
    }
    const { pointsMax, hintsUsedCount, failedAttemptsBefore } = input;
    const raw =
      pointsMax -
      hintsUsedCount * 0.1 * pointsMax -
      failedAttemptsBefore * 0.05 * pointsMax;
    const floor = 0.2 * pointsMax;
    return Math.floor(Math.max(raw, floor));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/scoring.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/state/types/scoring.types.ts src/state/services/scoring.service.ts test/state/scoring.service.spec.ts
git commit -m "feat: add scoring service with pure points formula"
```

---

## Task 10: Test DB Helper

**Files:**
- Create: `platform/test/helpers/db.ts`

The remaining repository tests need a clean database between runs. This helper resets all tables.

- [ ] **Step 1: Write the helper**

Create `platform/test/helpers/db.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export function makeTestPrisma(): PrismaClient {
  return new PrismaClient();
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  // Order matters: state half references content half via foreign-id strings (no FKs),
  // but Block has an actual FK to Lesson and must be cleared first.
  await prisma.attempt.deleteMany();
  await prisma.exerciseResult.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.block.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.track.deleteMany();
}
```

- [ ] **Step 2: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add test/helpers/db.ts
git commit -m "test: add db reset helper"
```

---

## Task 11: Track Repository

**Files:**
- Create: `platform/src/content/repositories/track.repository.ts`
- Create: `platform/test/content/track.repository.spec.ts`

Version-aware CRUD for Track. Two read modes: "latest published version of id" and "specific (id, version)."

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/track.repository.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('TrackRepository', () => {
  let prisma: PrismaClient;
  let repo: TrackRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new TrackRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft track with version 1', async () => {
    const id = newId();
    const created = await repo.createDraft({
      id,
      title: 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'Learn Swift basics',
      lessons: [],
    });
    expect(created.id).toBe(id);
    expect(created.version).toBe(1);
    expect(created.publishedAt).toBeNull();
  });

  it('publishes a track by setting publishedAt', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'Kotlin Fundamentals',
      language: 'kotlin',
      kind: 'fundamentals',
      description: 'Learn Kotlin basics',
      lessons: [],
    });
    const published = await repo.publish(id, 1);
    expect(published.publishedAt).not.toBeNull();
  });

  it('finds the latest published version', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'Swift v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);

    await repo.createNextVersion(id, {
      title: 'Swift v2',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 2);

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(2);
    expect(latest?.title).toBe('Swift v2');
  });

  it('does not return unpublished versions from findLatestPublished', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);
    await repo.createNextVersion(id, {
      title: 'v2 draft',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(1);
  });

  it('finds a specific version', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      title: 'v1',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });
    await repo.publish(id, 1);
    await repo.createNextVersion(id, {
      title: 'v2',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [],
    });

    const v1 = await repo.findByVersion(id, 1);
    expect(v1?.title).toBe('v1');
    const v2 = await repo.findByVersion(id, 2);
    expect(v2?.title).toBe('v2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/track.repository.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `platform/src/content/repositories/track.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Track, Language, TrackKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonRef = {
  id: string;
  version: number;
};

export type CreateTrackInput = {
  id: string;
  title: string;
  language: Language;
  kind: TrackKind;
  description: string;
  lessons: LessonRef[];
};

export type NextVersionInput = Omit<CreateTrackInput, 'id'>;

function splitLessonRefs(refs: LessonRef[]): { ids: string[]; versions: number[] } {
  return {
    ids: refs.map((r) => r.id),
    versions: refs.map((r) => r.version),
  };
}

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateTrackInput): Promise<Track> {
    const { ids, versions } = splitLessonRefs(input.lessons);
    return this.prisma.track.create({
      data: {
        id: input.id,
        version: 1,
        title: input.title,
        language: input.language,
        kind: input.kind,
        description: input.description,
        lessonIds: ids,
        lessonVersions: versions,
        publishedAt: null,
      },
    });
  }

  async createNextVersion(id: string, input: NextVersionInput): Promise<Track> {
    const latest = await this.prisma.track.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing track with id ${id}`);
    }
    const { ids, versions } = splitLessonRefs(input.lessons);
    return this.prisma.track.create({
      data: {
        id,
        version: latest.version + 1,
        title: input.title,
        language: input.language,
        kind: input.kind,
        description: input.description,
        lessonIds: ids,
        lessonVersions: versions,
        publishedAt: null,
      },
    });
  }

  async publish(id: string, version: number): Promise<Track> {
    return this.prisma.track.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Track | null> {
    return this.prisma.track.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findLatestPublished(id: string): Promise<Track | null> {
    return this.prisma.track.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/track.repository.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/repositories/track.repository.ts test/content/track.repository.spec.ts
git commit -m "feat: add version-aware track repository"
```

---

## Task 12: Lesson Repository

**Files:**
- Create: `platform/src/content/repositories/lesson.repository.ts`
- Create: `platform/test/content/lesson.repository.spec.ts`

Same shape as Task 11. Lesson rows also own their Block children.

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/lesson.repository.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('LessonRepository', () => {
  let prisma: PrismaClient;
  let repo: LessonRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new LessonRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft lesson with one explanation block and one exercise block', async () => {
    const lessonId = newId();
    const trackId = newId();
    const exerciseId = newId();

    const lesson = await repo.createDraft({
      id: lessonId,
      trackId,
      position: 0,
      title: 'Variables',
      level: 'beginner',
      summary: 'Intro to variables',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'explanation',
          explanationMarkdown: 'A variable is...',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId,
          exerciseVersion: 1,
        },
      ],
    });

    expect(lesson.id).toBe(lessonId);
    expect(lesson.version).toBe(1);
    expect(lesson.blockIds).toHaveLength(2);

    const fetched = await repo.findByVersionWithBlocks(lessonId, 1);
    expect(fetched?.blocks).toHaveLength(2);
    expect(fetched?.blocks[0].kind).toBe('explanation');
    expect(fetched?.blocks[1].kind).toBe('exercise');
    expect(fetched?.blocks[1].exerciseId).toBe(exerciseId);
  });

  it('publishes a lesson', async () => {
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
    const published = await repo.publish(id, 1);
    expect(published.publishedAt).not.toBeNull();
  });

  it('finds the latest published version', async () => {
    const id = newId();
    const trackId = newId();
    await repo.createDraft({
      id,
      trackId,
      position: 0,
      title: 'v1',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    await repo.publish(id, 1);

    await repo.createNextVersion(id, {
      trackId,
      position: 0,
      title: 'v2',
      level: 'beginner',
      summary: 's',
      blocks: [],
    });
    await repo.publish(id, 2);

    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(2);
    expect(latest?.title).toBe('v2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/lesson.repository.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `platform/src/content/repositories/lesson.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Lesson, Block, BlockKind, LessonLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type BlockInput = {
  id: string;
  position: number;
  kind: BlockKind;
  explanationMarkdown?: string | null;
  exerciseId?: string | null;
  exerciseVersion?: number | null;
};

export type CreateLessonInput = {
  id: string;
  trackId: string;
  position: number;
  title: string;
  level: LessonLevel;
  summary: string;
  blocks: BlockInput[];
};

export type NextLessonVersionInput = Omit<CreateLessonInput, 'id'>;

export type LessonWithBlocks = Lesson & { blocks: Block[] };

@Injectable()
export class LessonRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateLessonInput): Promise<Lesson> {
    return this.persistVersion(input.id, 1, input);
  }

  async createNextVersion(
    id: string,
    input: NextLessonVersionInput,
  ): Promise<Lesson> {
    const latest = await this.prisma.lesson.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing lesson with id ${id}`);
    }
    return this.persistVersion(id, latest.version + 1, input);
  }

  private async persistVersion(
    id: string,
    version: number,
    input: NextLessonVersionInput,
  ): Promise<Lesson> {
    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.create({
        data: {
          id,
          version,
          trackId: input.trackId,
          position: input.position,
          title: input.title,
          level: input.level,
          summary: input.summary,
          blockIds: input.blocks.map((b) => b.id),
          publishedAt: null,
        },
      });

      if (input.blocks.length > 0) {
        await tx.block.createMany({
          data: input.blocks.map((b) => ({
            id: b.id,
            lessonId: id,
            lessonVersion: version,
            position: b.position,
            kind: b.kind,
            explanationMarkdown: b.explanationMarkdown ?? null,
            exerciseId: b.exerciseId ?? null,
            exerciseVersion: b.exerciseVersion ?? null,
          })),
        });
      }

      return lesson;
    });
  }

  async publish(id: string, version: number): Promise<Lesson> {
    return this.prisma.lesson.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Lesson | null> {
    return this.prisma.lesson.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findByVersionWithBlocks(
    id: string,
    version: number,
  ): Promise<LessonWithBlocks | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id_version: { id, version } },
      include: { blocks: { orderBy: { position: 'asc' } } },
    });
    return lesson;
  }

  async findLatestPublished(id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/lesson.repository.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/repositories/lesson.repository.ts test/content/lesson.repository.spec.ts
git commit -m "feat: add version-aware lesson repository with block snapshots"
```

---

## Task 13: Exercise Repository

**Files:**
- Create: `platform/src/content/repositories/exercise.repository.ts`
- Create: `platform/test/content/exercise.repository.spec.ts`

Same shape, validates payload on write.

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/exercise.repository.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ExerciseRepository', () => {
  let prisma: PrismaClient;
  let repo: ExerciseRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new ExerciseRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a draft code exercise with valid payload', async () => {
    const id = newId();
    const created = await repo.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'Write a function that returns 1.',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func answer() -> Int { return 0 }',
        testCode: 'assert(answer() == 1)',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: ['Try returning 1.'],
      concepts: ['functions'],
    });
    expect(created.id).toBe(id);
    expect(created.version).toBe(1);
  });

  it('rejects creation with an invalid payload for the declared type', async () => {
    await expect(
      repo.createDraft({
        id: newId(),
        lessonId: newId(),
        promptMarkdown: 'q',
        type: 'code',
        payload: {
          type: 'multiple_choice',
          questionMarkdown: 'wrong shape',
          options: [],
          correctOptionIds: [],
          multiSelect: false,
        } as any,
        pointsMax: 100,
        hints: [],
        concepts: [],
      }),
    ).rejects.toThrow();
  });

  it('publishes and finds latest published', async () => {
    const id = newId();
    await repo.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'q',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 50,
      hints: [],
      concepts: [],
    });
    await repo.publish(id, 1);
    const latest = await repo.findLatestPublished(id);
    expect(latest?.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/exercise.repository.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `platform/src/content/repositories/exercise.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Exercise, ExerciseType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExercisePayload } from '../types/exercise-payload.types';
import { parseExercisePayload } from '../validators/exercise-payload.validator';

export type CreateExerciseInput = {
  id: string;
  lessonId: string;
  promptMarkdown: string;
  type: ExerciseType;
  payload: ExercisePayload;
  pointsMax: number;
  hints: string[];
  concepts: string[];
};

export type NextExerciseVersionInput = Omit<CreateExerciseInput, 'id'>;

@Injectable()
export class ExerciseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateExerciseInput): Promise<Exercise> {
    parseExercisePayload(input.type, input.payload);
    return this.prisma.exercise.create({
      data: {
        id: input.id,
        version: 1,
        lessonId: input.lessonId,
        promptMarkdown: input.promptMarkdown,
        type: input.type,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        pointsMax: input.pointsMax,
        hints: input.hints,
        concepts: input.concepts,
        publishedAt: null,
      },
    });
  }

  async createNextVersion(
    id: string,
    input: NextExerciseVersionInput,
  ): Promise<Exercise> {
    parseExercisePayload(input.type, input.payload);
    const latest = await this.prisma.exercise.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing exercise with id ${id}`);
    }
    return this.prisma.exercise.create({
      data: {
        id,
        version: latest.version + 1,
        lessonId: input.lessonId,
        promptMarkdown: input.promptMarkdown,
        type: input.type,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        pointsMax: input.pointsMax,
        hints: input.hints,
        concepts: input.concepts,
        publishedAt: null,
      },
    });
  }

  async publish(id: string, version: number): Promise<Exercise> {
    return this.prisma.exercise.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Exercise | null> {
    return this.prisma.exercise.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findLatestPublished(id: string): Promise<Exercise | null> {
    return this.prisma.exercise.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/exercise.repository.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/repositories/exercise.repository.ts test/content/exercise.repository.spec.ts
git commit -m "feat: add version-aware exercise repository with payload validation"
```

---

## Task 14: Student, Cohort, Enrollment Repositories

**Files:**
- Create: `platform/src/state/repositories/student.repository.ts`
- Create: `platform/src/state/repositories/cohort.repository.ts`
- Create: `platform/src/state/repositories/enrollment.repository.ts`

These three are simpler — no versioning. One test file covers all three together since they're tightly related.

- [ ] **Step 1: Write the StudentRepository**

Create `platform/src/state/repositories/student.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Student } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateStudentInput = {
  id: string;
  name: string;
  email: string;
  cohortId?: string | null;
};

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStudentInput): Promise<Student> {
    return this.prisma.student.create({
      data: {
        id: input.id,
        name: input.name,
        email: input.email,
        cohortId: input.cohortId ?? null,
      },
    });
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { email } });
  }
}
```

- [ ] **Step 2: Write the CohortRepository**

Create `platform/src/state/repositories/cohort.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Cohort } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateCohortInput = {
  id: string;
  name: string;
  instructorId: string;
  startDate: Date;
};

@Injectable()
export class CohortRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCohortInput): Promise<Cohort> {
    return this.prisma.cohort.create({ data: input });
  }

  async findById(id: string): Promise<Cohort | null> {
    return this.prisma.cohort.findUnique({ where: { id } });
  }
}
```

- [ ] **Step 3: Write the EnrollmentRepository**

Create `platform/src/state/repositories/enrollment.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Enrollment, EnrollmentStatus, LessonLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateEnrollmentInput = {
  id: string;
  studentId: string;
  trackId: string;
  trackVersion: number;
  assignedLevel: LessonLevel;
  currentLessonId?: string | null;
  currentLessonVersion?: number | null;
};

@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateEnrollmentInput): Promise<Enrollment> {
    return this.prisma.enrollment.create({
      data: {
        id: input.id,
        studentId: input.studentId,
        trackId: input.trackId,
        trackVersion: input.trackVersion,
        assignedLevel: input.assignedLevel,
        currentLessonId: input.currentLessonId ?? null,
        currentLessonVersion: input.currentLessonVersion ?? null,
        status: 'active',
      },
    });
  }

  async findById(id: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { id } });
  }

  async findByStudentAndTrack(
    studentId: string,
    trackId: string,
  ): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({
      where: { studentId_trackId: { studentId, trackId } },
    });
  }

  async setCurrentLesson(
    enrollmentId: string,
    lessonId: string,
    lessonVersion: number,
  ): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { currentLessonId: lessonId, currentLessonVersion: lessonVersion },
    });
  }

  async setStatus(
    enrollmentId: string,
    status: EnrollmentStatus,
  ): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });
  }
}
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: no errors. (Tests for these three are in Task 17's full-flow integration test, since they have no logic worth unit-testing in isolation.)

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/state/repositories/student.repository.ts src/state/repositories/cohort.repository.ts src/state/repositories/enrollment.repository.ts
git commit -m "feat: add student, cohort, enrollment repositories"
```

---

## Task 15: Attempt and ExerciseResult Repositories

**Files:**
- Create: `platform/src/state/repositories/attempt.repository.ts`
- Create: `platform/src/state/repositories/exercise-result.repository.ts`

Append-only Attempt + upsert ExerciseResult.

- [ ] **Step 1: Write the AttemptRepository**

Create `platform/src/state/repositories/attempt.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Attempt, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmissionPayload } from '../../content/types/submission-payload.types';

export type CreateAttemptInput = {
  id: string;
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  submissionPayload: SubmissionPayload;
  passed: boolean;
  hintsUsedCount: number;
  failedAttemptsBefore: number;
  pointsAwarded: number;
};

@Injectable()
export class AttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAttemptInput): Promise<Attempt> {
    return this.prisma.attempt.create({
      data: {
        id: input.id,
        studentId: input.studentId,
        exerciseId: input.exerciseId,
        exerciseVersion: input.exerciseVersion,
        submissionPayload: input.submissionPayload as unknown as Prisma.InputJsonValue,
        passed: input.passed,
        hintsUsedCount: input.hintsUsedCount,
        failedAttemptsBefore: input.failedAttemptsBefore,
        pointsAwarded: input.pointsAwarded,
      },
    });
  }

  async countByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<number> {
    return this.prisma.attempt.count({
      where: { studentId, exerciseId },
    });
  }

  async countFailedByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<number> {
    return this.prisma.attempt.count({
      where: { studentId, exerciseId, passed: false },
    });
  }

  async listByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<Attempt[]> {
    return this.prisma.attempt.findMany({
      where: { studentId, exerciseId },
      orderBy: { submittedAt: 'asc' },
    });
  }
}
```

- [ ] **Step 2: Write the ExerciseResultRepository**

Create `platform/src/state/repositories/exercise-result.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ExerciseResult } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type UpsertResultInput = {
  id: string;
  studentId: string;
  exerciseId: string;
  bestAttemptId: string;
  passed: boolean;
  pointsEarned: number;
  attemptsCount: number;
  firstPassedAt: Date | null;
};

@Injectable()
export class ExerciseResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<ExerciseResult | null> {
    return this.prisma.exerciseResult.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
  }

  async upsert(input: UpsertResultInput): Promise<ExerciseResult> {
    return this.prisma.exerciseResult.upsert({
      where: {
        studentId_exerciseId: {
          studentId: input.studentId,
          exerciseId: input.exerciseId,
        },
      },
      create: {
        id: input.id,
        studentId: input.studentId,
        exerciseId: input.exerciseId,
        bestAttemptId: input.bestAttemptId,
        passed: input.passed,
        pointsEarned: input.pointsEarned,
        attemptsCount: input.attemptsCount,
        firstPassedAt: input.firstPassedAt,
      },
      update: {
        bestAttemptId: input.bestAttemptId,
        passed: input.passed,
        pointsEarned: input.pointsEarned,
        attemptsCount: input.attemptsCount,
        firstPassedAt: input.firstPassedAt,
      },
    });
  }

  async listByStudent(studentId: string): Promise<ExerciseResult[]> {
    return this.prisma.exerciseResult.findMany({ where: { studentId } });
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/state/repositories/attempt.repository.ts src/state/repositories/exercise-result.repository.ts
git commit -m "feat: add attempt and exercise-result repositories"
```

---

## Task 16: AttemptService — Record an Attempt End-to-End

**Files:**
- Create: `platform/src/state/services/attempt.service.ts`
- Create: `platform/test/state/attempt.service.spec.ts`

This is the model's main write entry point for student activity. Validates the submission, looks up the exercise, runs the scoring formula, persists the Attempt, updates the rollup. Grading correctness (whether `passed` is true) is the *runner's* job in spec #5; this service receives `passed` as an input.

- [ ] **Step 1: Write the failing test**

Create `platform/test/state/attempt.service.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { AttemptService } from '../../src/state/services/attempt.service';
import { AttemptRepository } from '../../src/state/repositories/attempt.repository';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ScoringService } from '../../src/state/services/scoring.service';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('AttemptService', () => {
  let prisma: PrismaClient;
  let svc: AttemptService;
  let exerciseRepo: ExerciseRepository;

  let studentId: string;
  let exerciseId: string;

  beforeAll(() => {
    prisma = makeTestPrisma();
    const attemptRepo = new AttemptRepository(prisma as any);
    const resultRepo = new ExerciseResultRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    const scoring = new ScoringService();
    svc = new AttemptService(attemptRepo, resultRepo, exerciseRepo, scoring);
  });

  beforeEach(async () => {
    await resetDb(prisma);

    studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'A', email: `${studentId}@x.com` },
    });

    exerciseId = newId();
    await exerciseRepo.createDraft({
      id: exerciseId,
      lessonId: newId(),
      promptMarkdown: 'q',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: '',
        testCode: '',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: ['hint1', 'hint2'],
      concepts: ['x'],
    });
    await exerciseRepo.publish(exerciseId, 1);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records a passing first attempt with full points and creates a rollup', async () => {
    const result = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'let x = 1' },
      passed: true,
      hintsUsedCount: 0,
    });

    expect(result.attempt.passed).toBe(true);
    expect(result.attempt.pointsAwarded).toBe(100);
    expect(result.attempt.failedAttemptsBefore).toBe(0);
    expect(result.exerciseResult.passed).toBe(true);
    expect(result.exerciseResult.pointsEarned).toBe(100);
    expect(result.exerciseResult.attemptsCount).toBe(1);
    expect(result.exerciseResult.firstPassedAt).not.toBeNull();
  });

  it('counts prior failed attempts and applies penalty', async () => {
    await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'wrong' },
      passed: false,
      hintsUsedCount: 0,
    });
    await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'wrong again' },
      passed: false,
      hintsUsedCount: 1,
    });

    const third = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'right' },
      passed: true,
      hintsUsedCount: 1,
    });

    // 2 failed attempts before (5% * 2 = 10%) + 1 hint (10%) = 80
    expect(third.attempt.failedAttemptsBefore).toBe(2);
    expect(third.attempt.pointsAwarded).toBe(80);
    expect(third.exerciseResult.passed).toBe(true);
    expect(third.exerciseResult.pointsEarned).toBe(80);
    expect(third.exerciseResult.attemptsCount).toBe(3);
  });

  it('keeps the highest pointsEarned across passing attempts', async () => {
    const first = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'ok' },
      passed: true,
      hintsUsedCount: 2, // 80 points
    });
    expect(first.exerciseResult.pointsEarned).toBe(80);

    const second = await svc.recordAttempt({
      studentId,
      exerciseId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'ok again' },
      passed: true,
      hintsUsedCount: 0, // would be 95: 100 - 1 failed (none) - 0 hints = 100; but failedAttemptsBefore stays 0
    });
    // Note: failedAttemptsBefore counts only failed attempts; both passed.
    // Second attempt: 100 - 0 hints - 0 failed = 100
    expect(second.attempt.pointsAwarded).toBe(100);
    expect(second.exerciseResult.pointsEarned).toBe(100);
  });

  it('rejects an attempt with a submission payload that does not match the exercise type', async () => {
    await expect(
      svc.recordAttempt({
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submissionPayload: {
          type: 'multiple_choice',
          selectedOptionIds: ['a'],
        } as any,
        passed: true,
        hintsUsedCount: 0,
      }),
    ).rejects.toThrow();
  });

  it('rejects an attempt referencing a non-existent exercise version', async () => {
    await expect(
      svc.recordAttempt({
        studentId,
        exerciseId,
        exerciseVersion: 99,
        submissionPayload: { type: 'code', code: 'x' },
        passed: true,
        hintsUsedCount: 0,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/attempt.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AttemptService**

Create `platform/src/state/services/attempt.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Attempt, ExerciseResult } from '@prisma/client';
import { newId } from '../../shared/ids';
import { ExerciseRepository } from '../../content/repositories/exercise.repository';
import { parseSubmissionPayload } from '../../content/validators/submission-payload.validator';
import { SubmissionPayload } from '../../content/types/submission-payload.types';
import { AttemptRepository } from '../repositories/attempt.repository';
import { ExerciseResultRepository } from '../repositories/exercise-result.repository';
import { ScoringService } from './scoring.service';

export type RecordAttemptInput = {
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  submissionPayload: SubmissionPayload;
  passed: boolean;
  hintsUsedCount: number;
};

export type RecordAttemptResult = {
  attempt: Attempt;
  exerciseResult: ExerciseResult;
};

@Injectable()
export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly results: ExerciseResultRepository,
    private readonly exercises: ExerciseRepository,
    private readonly scoring: ScoringService,
  ) {}

  async recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptResult> {
    const exercise = await this.exercises.findByVersion(
      input.exerciseId,
      input.exerciseVersion,
    );
    if (!exercise) {
      throw new Error(
        `Exercise ${input.exerciseId} v${input.exerciseVersion} not found`,
      );
    }

    parseSubmissionPayload(exercise.type, input.submissionPayload);

    const failedAttemptsBefore = await this.attempts.countFailedByStudentAndExercise(
      input.studentId,
      input.exerciseId,
    );

    const pointsAwarded = this.scoring.computePoints({
      passed: input.passed,
      pointsMax: exercise.pointsMax,
      hintsUsedCount: input.hintsUsedCount,
      failedAttemptsBefore,
    });

    const attempt = await this.attempts.create({
      id: newId(),
      studentId: input.studentId,
      exerciseId: input.exerciseId,
      exerciseVersion: input.exerciseVersion,
      submissionPayload: input.submissionPayload,
      passed: input.passed,
      hintsUsedCount: input.hintsUsedCount,
      failedAttemptsBefore,
      pointsAwarded,
    });

    const existingResult = await this.results.findByStudentAndExercise(
      input.studentId,
      input.exerciseId,
    );
    const totalAttempts = (existingResult?.attemptsCount ?? 0) + 1;

    const newPassed = (existingResult?.passed ?? false) || input.passed;
    const previousPoints = existingResult?.pointsEarned ?? 0;
    const newPoints = Math.max(previousPoints, pointsAwarded);
    const bestAttemptId =
      newPoints > previousPoints ? attempt.id : existingResult?.bestAttemptId ?? attempt.id;
    const firstPassedAt =
      existingResult?.firstPassedAt ?? (input.passed ? attempt.submittedAt : null);

    const exerciseResult = await this.results.upsert({
      id: existingResult?.id ?? newId(),
      studentId: input.studentId,
      exerciseId: input.exerciseId,
      bestAttemptId,
      passed: newPassed,
      pointsEarned: newPoints,
      attemptsCount: totalAttempts,
      firstPassedAt,
    });

    return { attempt, exerciseResult };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/attempt.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/state/services/attempt.service.ts test/state/attempt.service.spec.ts
git commit -m "feat: add attempt service that records submissions and rolls up results"
```

---

## Task 17: ProgressService — Derived Lesson and Track State

**Files:**
- Create: `platform/src/state/services/progress.service.ts`
- Create: `platform/test/state/progress.service.spec.ts`

Computes "is this lesson completed?" and "is this track completed?" by checking ExerciseResult against the lesson's exercise blocks.

- [ ] **Step 1: Write the failing test**

Create `platform/test/state/progress.service.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { ProgressService } from '../../src/state/services/progress.service';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressService', () => {
  let prisma: PrismaClient;
  let svc: ProgressService;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;
  let resultRepo: ExerciseResultRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    lessonRepo = new LessonRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    resultRepo = new ExerciseResultRepository(prisma as any);
    const trackRepo = new TrackRepository(prisma as any);
    svc = new ProgressService(lessonRepo, resultRepo, trackRepo);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeLessonWithTwoExercises(): Promise<{
    lessonId: string;
    lessonVersion: number;
    exerciseIds: [string, string];
  }> {
    const exA = newId();
    const exB = newId();
    await exerciseRepo.createDraft({
      id: exA,
      lessonId: newId(),
      promptMarkdown: 'a',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exA, 1);
    await exerciseRepo.createDraft({
      id: exB,
      lessonId: newId(),
      promptMarkdown: 'b',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exB, 1);

    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'L',
      level: 'beginner',
      summary: 's',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'exercise',
          exerciseId: exA,
          exerciseVersion: 1,
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exB,
          exerciseVersion: 1,
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    return { lessonId, lessonVersion: 1, exerciseIds: [exA, exB] };
  }

  it('reports a lesson as not completed when no exercises are passed', async () => {
    const { lessonId, lessonVersion } = await makeLessonWithTwoExercises();
    const studentId = newId();
    const completed = await svc.isLessonCompleted(studentId, lessonId, lessonVersion);
    expect(completed).toBe(false);
  });

  it('reports a lesson as not completed when only one of two exercises is passed', async () => {
    const { lessonId, lessonVersion, exerciseIds } = await makeLessonWithTwoExercises();
    const studentId = newId();
    await resultRepo.upsert({
      id: newId(),
      studentId,
      exerciseId: exerciseIds[0],
      bestAttemptId: newId(),
      passed: true,
      pointsEarned: 10,
      attemptsCount: 1,
      firstPassedAt: new Date(),
    });
    const completed = await svc.isLessonCompleted(studentId, lessonId, lessonVersion);
    expect(completed).toBe(false);
  });

  it('reports a lesson as completed when all exercises are passed', async () => {
    const { lessonId, lessonVersion, exerciseIds } = await makeLessonWithTwoExercises();
    const studentId = newId();
    for (const exId of exerciseIds) {
      await resultRepo.upsert({
        id: newId(),
        studentId,
        exerciseId: exId,
        bestAttemptId: newId(),
        passed: true,
        pointsEarned: 10,
        attemptsCount: 1,
        firstPassedAt: new Date(),
      });
    }
    const completed = await svc.isLessonCompleted(studentId, lessonId, lessonVersion);
    expect(completed).toBe(true);
  });

  it('ignores explanation blocks when computing lesson completion', async () => {
    const exA = newId();
    await exerciseRepo.createDraft({
      id: exA,
      lessonId: newId(),
      promptMarkdown: 'a',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: [],
    });
    await exerciseRepo.publish(exA, 1);

    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'L',
      level: 'beginner',
      summary: 's',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'explanation',
          explanationMarkdown: 'read this',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exA,
          exerciseVersion: 1,
        },
      ],
    });
    await lessonRepo.publish(lessonId, 1);

    const studentId = newId();
    await resultRepo.upsert({
      id: newId(),
      studentId,
      exerciseId: exA,
      bestAttemptId: newId(),
      passed: true,
      pointsEarned: 10,
      attemptsCount: 1,
      firstPassedAt: new Date(),
    });

    const completed = await svc.isLessonCompleted(studentId, lessonId, 1);
    expect(completed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/progress.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ProgressService**

Create `platform/src/state/services/progress.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { LessonRepository } from '../../content/repositories/lesson.repository';
import { TrackRepository } from '../../content/repositories/track.repository';
import { ExerciseResultRepository } from '../repositories/exercise-result.repository';

@Injectable()
export class ProgressService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly results: ExerciseResultRepository,
    private readonly tracks: TrackRepository,
  ) {}

  async isLessonCompleted(
    studentId: string,
    lessonId: string,
    lessonVersion: number,
  ): Promise<boolean> {
    const lesson = await this.lessons.findByVersionWithBlocks(lessonId, lessonVersion);
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} v${lessonVersion} not found`);
    }
    const exerciseBlocks = lesson.blocks.filter((b) => b.kind === 'exercise');
    if (exerciseBlocks.length === 0) {
      return true;
    }
    for (const block of exerciseBlocks) {
      if (!block.exerciseId) continue;
      const result = await this.results.findByStudentAndExercise(
        studentId,
        block.exerciseId,
      );
      if (!result || !result.passed) {
        return false;
      }
    }
    return true;
  }

  async isTrackCompleted(
    studentId: string,
    trackId: string,
    trackVersion: number,
  ): Promise<boolean> {
    const track = await this.tracks.findByVersion(trackId, trackVersion);
    if (!track) {
      throw new Error(`Track ${trackId} v${trackVersion} not found`);
    }
    if (track.lessonIds.length !== track.lessonVersions.length) {
      throw new Error(
        `Track ${trackId} v${trackVersion} has mismatched lessonIds/lessonVersions arrays`,
      );
    }
    for (let i = 0; i < track.lessonIds.length; i++) {
      const done = await this.isLessonCompleted(
        studentId,
        track.lessonIds[i],
        track.lessonVersions[i],
      );
      if (!done) {
        return false;
      }
    }
    return true;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/state/progress.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/state/services/progress.service.ts test/state/progress.service.spec.ts
git commit -m "feat: add progress service for derived lesson and track completion"
```

---

## Task 18: PublishService — Snapshot Workflow

**Files:**
- Create: `platform/src/content/services/publish.service.ts`
- Create: `platform/test/content/publish.service.spec.ts`

A thin orchestration service. Currently the repositories already expose `publish`; this service adds the convenience of "publish a track and all its referenced lessons + exercises atomically." Useful for the seed flow and integration tests.

- [ ] **Step 1: Write the failing test**

Create `platform/test/content/publish.service.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PublishService } from '../../src/content/services/publish.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('PublishService', () => {
  let prisma: PrismaClient;
  let svc: PublishService;
  let trackRepo: TrackRepository;
  let lessonRepo: LessonRepository;
  let exerciseRepo: ExerciseRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    trackRepo = new TrackRepository(prisma as any);
    lessonRepo = new LessonRepository(prisma as any);
    exerciseRepo = new ExerciseRepository(prisma as any);
    svc = new PublishService(trackRepo, lessonRepo, exerciseRepo);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('publishes a track, its lessons, and its exercises', async () => {
    const exId = newId();
    await exerciseRepo.createDraft({
      id: exId,
      lessonId: newId(),
      promptMarkdown: 'q',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: [],
    });

    const lessonId = newId();
    await lessonRepo.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'L',
      level: 'beginner',
      summary: 's',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'exercise',
          exerciseId: exId,
          exerciseVersion: 1,
        },
      ],
    });

    const trackId = newId();
    await trackRepo.createDraft({
      id: trackId,
      title: 'T',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [{ id: lessonId, version: 1 }],
    });

    await svc.publishTrack(trackId, 1);

    const track = await trackRepo.findByVersion(trackId, 1);
    expect(track?.publishedAt).not.toBeNull();
    const lesson = await lessonRepo.findByVersion(lessonId, 1);
    expect(lesson?.publishedAt).not.toBeNull();
    const exercise = await exerciseRepo.findByVersion(exId, 1);
    expect(exercise?.publishedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/publish.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PublishService**

Create `platform/src/content/services/publish.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { TrackRepository } from '../repositories/track.repository';
import { LessonRepository } from '../repositories/lesson.repository';
import { ExerciseRepository } from '../repositories/exercise.repository';

@Injectable()
export class PublishService {
  constructor(
    private readonly tracks: TrackRepository,
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
  ) {}

  async publishTrack(trackId: string, trackVersion: number): Promise<void> {
    const track = await this.tracks.findByVersion(trackId, trackVersion);
    if (!track) {
      throw new Error(`Track ${trackId} v${trackVersion} not found`);
    }
    if (track.lessonIds.length !== track.lessonVersions.length) {
      throw new Error(
        `Track ${trackId} v${trackVersion} has mismatched lessonIds/lessonVersions arrays`,
      );
    }

    for (let i = 0; i < track.lessonIds.length; i++) {
      const lessonId = track.lessonIds[i];
      const lessonVersion = track.lessonVersions[i];

      const lessonWithBlocks = await this.lessons.findByVersionWithBlocks(
        lessonId,
        lessonVersion,
      );
      if (!lessonWithBlocks) continue;

      for (const block of lessonWithBlocks.blocks) {
        if (block.kind === 'exercise' && block.exerciseId && block.exerciseVersion) {
          const ex = await this.exercises.findByVersion(
            block.exerciseId,
            block.exerciseVersion,
          );
          if (ex && ex.publishedAt === null) {
            await this.exercises.publish(block.exerciseId, block.exerciseVersion);
          }
        }
      }

      if (lessonWithBlocks.publishedAt === null) {
        await this.lessons.publish(lessonId, lessonVersion);
      }
    }

    if (track.publishedAt === null) {
      await this.tracks.publish(trackId, trackVersion);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/content/publish.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/services/publish.service.ts test/content/publish.service.spec.ts
git commit -m "feat: add publish service for track-cascade publishing"
```

---

## Task 19: Wire Modules Together

**Files:**
- Create: `platform/src/content/content.module.ts`
- Create: `platform/src/state/state.module.ts`
- Modify: `platform/src/app.module.ts`

- [ ] **Step 1: Write ContentModule**

Create `platform/src/content/content.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { ExerciseRepository } from './repositories/exercise.repository';
import { PublishService } from './services/publish.service';

@Module({
  providers: [TrackRepository, LessonRepository, ExerciseRepository, PublishService],
  exports: [TrackRepository, LessonRepository, ExerciseRepository, PublishService],
})
export class ContentModule {}
```

- [ ] **Step 2: Write StateModule**

Create `platform/src/state/state.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { StudentRepository } from './repositories/student.repository';
import { CohortRepository } from './repositories/cohort.repository';
import { EnrollmentRepository } from './repositories/enrollment.repository';
import { AttemptRepository } from './repositories/attempt.repository';
import { ExerciseResultRepository } from './repositories/exercise-result.repository';
import { ScoringService } from './services/scoring.service';
import { AttemptService } from './services/attempt.service';
import { ProgressService } from './services/progress.service';

@Module({
  imports: [ContentModule],
  providers: [
    StudentRepository,
    CohortRepository,
    EnrollmentRepository,
    AttemptRepository,
    ExerciseResultRepository,
    ScoringService,
    AttemptService,
    ProgressService,
  ],
  exports: [
    StudentRepository,
    CohortRepository,
    EnrollmentRepository,
    AttemptRepository,
    ExerciseResultRepository,
    ScoringService,
    AttemptService,
    ProgressService,
  ],
})
export class StateModule {}
```

- [ ] **Step 3: Update AppModule**

Replace the contents of `platform/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContentModule } from './content/content.module';
import { StateModule } from './state/state.module';

@Module({
  imports: [PrismaModule, ContentModule, StateModule],
})
export class AppModule {}
```

- [ ] **Step 4: Verify build**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add src/content/content.module.ts src/state/state.module.ts src/app.module.ts
git commit -m "feat: wire content and state modules into app module"
```

---

## Task 20: Full-Flow Integration Test

**Files:**
- Create: `platform/test/integration/full-flow.spec.ts`

Covers Success Criteria #1, #2, #3, #6 from the spec end-to-end. This test exercises every entity and service together.

- [ ] **Step 1: Write the integration test**

Create `platform/test/integration/full-flow.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { PublishService } from '../../src/content/services/publish.service';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { EnrollmentRepository } from '../../src/state/repositories/enrollment.repository';
import { AttemptService } from '../../src/state/services/attempt.service';
import { ProgressService } from '../../src/state/services/progress.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('Full curriculum + state flow', () => {
  let app: import('@nestjs/common').INestApplication;
  let prisma: PrismaService;
  let tracks: TrackRepository;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let publish: PublishService;
  let students: StudentRepository;
  let enrollments: EnrollmentRepository;
  let attempts: AttemptService;
  let progress: ProgressService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
    tracks = moduleRef.get(TrackRepository);
    lessons = moduleRef.get(LessonRepository);
    exercises = moduleRef.get(ExerciseRepository);
    publish = moduleRef.get(PublishService);
    students = moduleRef.get(StudentRepository);
    enrollments = moduleRef.get(EnrollmentRepository);
    attempts = moduleRef.get(AttemptService);
    progress = moduleRef.get(ProgressService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs an end-to-end student journey through one lesson with two exercises', async () => {
    // 1. Author content
    const exAId = newId();
    await exercises.createDraft({
      id: exAId,
      lessonId: newId(),
      promptMarkdown: 'Pick the right answer',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'What is 2+2?',
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '4' },
        ],
        correctOptionIds: ['b'],
        multiSelect: false,
      },
      pointsMax: 100,
      hints: ['Think about it.'],
      concepts: ['arithmetic'],
    });

    const exBId = newId();
    await exercises.createDraft({
      id: exBId,
      lessonId: newId(),
      promptMarkdown: 'Write code',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func answer() -> Int { return 0 }',
        testCode: 'assert(answer() == 1)',
        testEntryPoint: 'runTests',
      },
      pointsMax: 100,
      hints: [],
      concepts: ['functions'],
    });

    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId,
      trackId: newId(),
      position: 0,
      title: 'Lesson 1',
      level: 'beginner',
      summary: 'First lesson',
      blocks: [
        {
          id: newId(),
          position: 0,
          kind: 'explanation',
          explanationMarkdown: 'Welcome',
        },
        {
          id: newId(),
          position: 1,
          kind: 'exercise',
          exerciseId: exAId,
          exerciseVersion: 1,
        },
        {
          id: newId(),
          position: 2,
          kind: 'exercise',
          exerciseId: exBId,
          exerciseVersion: 1,
        },
      ],
    });

    const trackId = newId();
    await tracks.createDraft({
      id: trackId,
      title: 'Swift Fundamentals',
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: [{ id: lessonId, version: 1 }],
    });

    // 2. Publish everything
    await publish.publishTrack(trackId, 1);

    // 3. Enroll a student
    const studentId = newId();
    await students.create({ id: studentId, name: 'Pat', email: 'pat@x.com' });
    await enrollments.create({
      id: newId(),
      studentId,
      trackId,
      trackVersion: 1,
      assignedLevel: 'beginner',
      currentLessonId: lessonId,
      currentLessonVersion: 1,
    });

    // 4. Attempt the multiple choice — pass first try
    const r1 = await attempts.recordAttempt({
      studentId,
      exerciseId: exAId,
      exerciseVersion: 1,
      submissionPayload: {
        type: 'multiple_choice',
        selectedOptionIds: ['b'],
      },
      passed: true,
      hintsUsedCount: 0,
    });
    expect(r1.attempt.pointsAwarded).toBe(100);

    // 5. Attempt the code exercise — fail twice, then pass with one hint
    await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'still 0' },
      passed: false,
      hintsUsedCount: 0,
    });
    await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'still 0' },
      passed: false,
      hintsUsedCount: 0,
    });
    const r4 = await attempts.recordAttempt({
      studentId,
      exerciseId: exBId,
      exerciseVersion: 1,
      submissionPayload: { type: 'code', code: 'return 1' },
      passed: true,
      hintsUsedCount: 0,
    });
    // 2 failed attempts before * 5% = 10% penalty → 90
    expect(r4.attempt.pointsAwarded).toBe(90);
    expect(r4.exerciseResult.attemptsCount).toBe(3);

    // 6. Verify lesson is completed
    const lessonDone = await progress.isLessonCompleted(studentId, lessonId, 1);
    expect(lessonDone).toBe(true);

    // 7. Verify track is completed (only one lesson)
    const trackDone = await progress.isTrackCompleted(studentId, trackId, 1);
    expect(trackDone).toBe(true);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx jest test/integration/full-flow.spec.ts
```

Expected: passes.

- [ ] **Step 3: Run the entire test suite**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm test
```

Expected: every test in `test/` passes. No skipped tests.

- [ ] **Step 4: Commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add test/integration/full-flow.spec.ts
git commit -m "test: add end-to-end integration test for full curriculum flow"
```

---

## Task 21: Final Verification

- [ ] **Step 1: Clean build**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
rm -rf dist
npm run build
```

Expected: no errors, `dist/` is recreated.

- [ ] **Step 2: Lint**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run lint
```

Expected: no errors. (Nest CLI generates ESLint config; if there are warnings on generated files, leave them.)

- [ ] **Step 3: Full test suite, fresh DB**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
docker compose down -v
docker compose up -d
npx prisma migrate deploy
npm test
```

Expected: every test passes against a freshly migrated database.

- [ ] **Step 4: Confirm spec coverage**

Walk through the spec's *Success Criteria* section and verify the test suite covers each item:

1. Render lesson with right version of every block → covered by `lesson.repository.spec.ts` `findByVersionWithBlocks` test and `full-flow.spec.ts`
2. Submit code exercise with point calculation → `attempt.service.spec.ts` and `full-flow.spec.ts`
3. Determine which lesson next → `progress.service.spec.ts` (lesson completion), with full-track lookup in `progress.service.spec.ts`'s `isTrackCompleted`
4. Cohort leaderboard query support → `ExerciseResult.listByStudent` and Attempt indexes exist; explicit query is owned by spec #6
5. Show all attempts for a student/exercise → `attempt.repository.spec.ts` covers `listByStudentAndExercise` (verify via the integration test reading attempts)
6. Edit a typo → `track.repository.spec.ts` `createNextVersion` test
7. Placement quiz routing → not exercised end-to-end (the placement-quiz workflow is itself a Track of `kind = placement`; routing logic belongs to the lesson runtime, spec #2). This spec only requires the data shape exists, which it does (Enrollment.assignedLevel, Track.kind = placement).

If anything fails, fix it before declaring done.

- [ ] **Step 5: Final commit**

```bash
cd c:/Users/ricma/BootCamp/platform
git add -A
git commit --allow-empty -m "chore: content & curriculum model implementation complete"
```
