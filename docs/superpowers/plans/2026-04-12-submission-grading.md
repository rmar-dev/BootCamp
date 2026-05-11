# Submission & Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `AttemptService` + `ScoringService` + `ExerciseResultRepository` into a `POST /api/submit` endpoint that persists graded attempts for all 5 exercise types, and update the web UI to show points. "Run" stays ephemeral (practice); "Submit" persists and scores.

**Architecture:** New `SubmissionModule` orchestrates: server-side answer validation (for MC/fill/predict) or code execution (for code/fix_bug via existing `RunnerService`), auto-creates `Student` on first submit, delegates to `AttemptService.recordAttempt()` for persistence + scoring, returns points. Web gains `lib/submit.ts`, a `PointsBadge`, and all 5 renderers switch their graded action to server-side submit.

**Tech Stack:** Backend: NestJS 10, Prisma 5, existing StateModule + ExecutionModule + ContentModule + AuthModule. Frontend: Next.js 14.

**Repo state:** Platform `master` at `6ae75d5` (111 tests). Web master at `a2b2ec1` (51 tests).

**Key existing infrastructure (spec #1, already tested):**
- `AttemptService.recordAttempt(input)` — counts prior failures, scores via `ScoringService`, creates `Attempt`, upserts `ExerciseResult` with best-attempt model. Fully tested.
- `ExerciseResultRepository.listByStudent(studentId)` — returns all results for a student.
- `ScoringService.computePoints({passed, pointsMax, hintsUsedCount, failedAttemptsBefore})` — the formula.
- `SubmissionPayload` types at `src/content/types/submission-payload.types.ts` — discriminated union for all 5 types.
- `StudentRepository.create({id, name, email, cohortId})` — exists but does NOT accept `userId` yet.

---

## Task 0: Branch setup

- [ ] **Step 1: Create branch**

```bash
cd c:/Users/ricma/BootCamp/platform
git checkout master
git checkout -b feat/submission
```

---

## Task 1: server-check.ts (pure function, TDD)

**Files:**
- Create: `platform/src/submission/server-check.ts`
- Create: `platform/test/submission/server-check.spec.ts`

Server-side answer validation for the 3 non-execution types. Same logic as `web/lib/check.ts`.

- [ ] **Step 1: Write the failing test**

Create `platform/test/submission/server-check.spec.ts`:

```ts
import { serverCheck } from '../../src/submission/server-check';

describe('serverCheck', () => {
  it('multiple_choice: passes on set equality', () => {
    const payload = {
      type: 'multiple_choice' as const,
      questionMarkdown: 'q',
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      correctOptionIds: ['a'],
      multiSelect: false,
    };
    expect(serverCheck(payload, ['a'])).toEqual({ passed: true });
    expect(serverCheck(payload, ['b'])).toEqual({ passed: false });
  });

  it('multiple_choice: multi-select set equality', () => {
    const payload = {
      type: 'multiple_choice' as const,
      questionMarkdown: 'q',
      options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
      correctOptionIds: ['a', 'b'],
      multiSelect: true,
    };
    expect(serverCheck(payload, ['b', 'a'])).toEqual({ passed: true });
    expect(serverCheck(payload, ['a'])).toEqual({ passed: false });
  });

  it('fill_blank: trimmed case-sensitive match against expected[]', () => {
    const payload = {
      type: 'fill_blank' as const,
      language: 'swift' as const,
      template: 'let {{n}} = 1',
      blanks: [{ id: 'n', expected: ['x', 'y'] }],
    };
    expect(serverCheck(payload, { n: '  x  ' })).toEqual({ passed: true });
    expect(serverCheck(payload, { n: 'y' })).toEqual({ passed: true });
    expect(serverCheck(payload, { n: 'X' })).toEqual({ passed: false });
    expect(serverCheck(payload, {})).toEqual({ passed: false });
  });

  it('predict_output: trimmed equality', () => {
    const payload = {
      type: 'predict_output' as const,
      displayedCode: 'print(1)',
      displayedLanguage: 'swift' as const,
      expectedOutput: '1',
    };
    expect(serverCheck(payload, '  1  ')).toEqual({ passed: true });
    expect(serverCheck(payload, '2')).toEqual({ passed: false });
  });

  it('throws for code/fix_bug', () => {
    const payload = { type: 'code' as const, language: 'swift' as const, starterCode: '', testCode: '', testEntryPoint: '' };
    expect(() => serverCheck(payload, '')).toThrow();
  });
});
```

- [ ] **Step 2: Implement**

Create `platform/src/submission/server-check.ts`:

```ts
import { ExercisePayload } from '../content/types/exercise-payload.types';

export function serverCheck(payload: ExercisePayload, answer: unknown): { passed: boolean } {
  switch (payload.type) {
    case 'multiple_choice': {
      const submitted = new Set((answer as string[]) ?? []);
      const correct = new Set(payload.correctOptionIds);
      if (submitted.size !== correct.size) return { passed: false };
      for (const id of submitted) if (!correct.has(id)) return { passed: false };
      return { passed: true };
    }
    case 'fill_blank': {
      const map = (answer as Record<string, string>) ?? {};
      for (const blank of payload.blanks) {
        const given = (map[blank.id] ?? '').trim();
        if (!blank.expected.includes(given)) return { passed: false };
      }
      return { passed: true };
    }
    case 'predict_output': {
      const given = String(answer ?? '').trim();
      return { passed: given === payload.expectedOutput.trim() };
    }
    case 'code':
    case 'fix_bug':
      throw new Error('serverCheck does not handle execution types');
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest server-check -i
```
Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/submission/server-check.ts test/submission/server-check.spec.ts
git commit -m "feat: add server-side answer check for MC/fill/predict"
```

---

## Task 2: StudentRepository.findByUserId + ensureStudent

**Files:**
- Modify: `platform/src/state/repositories/student.repository.ts`
- Create: `platform/src/submission/ensure-student.ts`
- Create: `platform/test/submission/ensure-student.spec.ts`

The existing `StudentRepository.create()` does not accept `userId`. We need `findByUserId()` and a helper to auto-create a Student on first submission.

- [ ] **Step 1: Add findByUserId to StudentRepository**

Read `platform/src/state/repositories/student.repository.ts`. Add:

```ts
async findByUserId(userId: string): Promise<Student | null> {
  return this.prisma.student.findFirst({ where: { userId } });
}
```

Also update `CreateStudentInput` to include optional `userId`:

```ts
export type CreateStudentInput = {
  id: string;
  name: string;
  email: string;
  cohortId?: string | null;
  userId?: string | null;
};
```

And update the `create` method to pass `userId`:

```ts
async create(input: CreateStudentInput): Promise<Student> {
  return this.prisma.student.create({
    data: {
      id: input.id,
      name: input.name,
      email: input.email,
      cohortId: input.cohortId ?? null,
      userId: input.userId ?? null,
    },
  });
}
```

- [ ] **Step 2: Create ensureStudent helper**

Create `platform/src/submission/ensure-student.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Student } from '@prisma/client';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { newId } from '../shared/ids';

@Injectable()
export class EnsureStudentService {
  constructor(
    private readonly students: StudentRepository,
    private readonly users: UserRepository,
  ) {}

  async ensureStudent(userId: string): Promise<Student> {
    const existing = await this.students.findByUserId(userId);
    if (existing) return existing;

    const user = await this.users.findById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    return this.students.create({
      id: newId(),
      name: user.name,
      email: user.email,
      userId: user.id,
    });
  }
}
```

- [ ] **Step 3: Write tests**

Create `platform/test/submission/ensure-student.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { EnsureStudentService } from '../../src/submission/ensure-student';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { UserRepository } from '../../src/auth/user.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('EnsureStudentService', () => {
  let prisma: PrismaClient;
  let svc: EnsureStudentService;
  let users: UserRepository;
  let students: StudentRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    users = new UserRepository(prisma as any);
    students = new StudentRepository(prisma as any);
    svc = new EnsureStudentService(students, users);
  });

  beforeEach(async () => { await resetDb(prisma); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('creates a student linked to the user on first call', async () => {
    const user = await users.create({ id: newId(), email: 'stu@test.com', name: 'Stu', role: 'student' });
    const student = await svc.ensureStudent(user.id);
    expect(student.userId).toBe(user.id);
    expect(student.email).toBe('stu@test.com');
    expect(student.name).toBe('Stu');
  });

  it('returns existing student on subsequent calls', async () => {
    const user = await users.create({ id: newId(), email: 'rep@test.com', name: 'Rep', role: 'student' });
    const first = await svc.ensureStudent(user.id);
    const second = await svc.ensureStudent(user.id);
    expect(second.id).toBe(first.id);
  });

  it('throws when user does not exist', async () => {
    await expect(svc.ensureStudent(newId())).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest ensure-student -i
```
Expected: 3 PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: all prior tests still pass + 3 new.

- [ ] **Step 6: Commit**

```bash
git add src/state/repositories/student.repository.ts src/submission/ensure-student.ts test/submission/ensure-student.spec.ts
git commit -m "feat: add ensureStudent and StudentRepository.findByUserId"
```

---

## Task 3: SubmissionService (TDD)

**Files:**
- Create: `platform/src/submission/submission.service.ts`
- Create: `platform/test/submission/submission.service.spec.ts`

Orchestrates the submission flow: validates exercise, determines pass/fail, ensures student, delegates to `AttemptService.recordAttempt()`, computes total points, returns `SubmitResponse`.

- [ ] **Step 1: Write the failing test**

Create `platform/test/submission/submission.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { SubmissionService } from '../../src/submission/submission.service';

function mockExerciseRepo(exercise: any) {
  return { findByVersion: jest.fn().mockResolvedValue(exercise) } as any;
}

function mockRunnerService(result: any) {
  return { run: jest.fn().mockResolvedValue(result) } as any;
}

function mockAttemptService(result: any) {
  return { recordAttempt: jest.fn().mockResolvedValue(result) } as any;
}

function mockEnsureStudent(studentId: string) {
  return { ensureStudent: jest.fn().mockResolvedValue({ id: studentId }) } as any;
}

function mockResultRepo(results: any[] = []) {
  return { listByStudent: jest.fn().mockResolvedValue(results) } as any;
}

const mcExercise = {
  id: 'ex-1', version: 1, type: 'multiple_choice', pointsMax: 100,
  publishedAt: new Date(),
  payload: {
    type: 'multiple_choice', questionMarkdown: 'q',
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    correctOptionIds: ['a'], multiSelect: false,
  },
};

const codeExercise = {
  id: 'ex-2', version: 1, type: 'code', pointsMax: 100,
  publishedAt: new Date(),
  payload: {
    type: 'code', language: 'swift', starterCode: '',
    testCode: 'assert(true)', testEntryPoint: 'f',
  },
};

const attemptResult = {
  attempt: { id: 'att-1', pointsAwarded: 100 },
  exerciseResult: { pointsEarned: 100, attemptsCount: 1, passed: true },
};

describe('SubmissionService', () => {
  it('MC: correct answer returns passed + points', async () => {
    const svc = new SubmissionService(
      mockExerciseRepo(mcExercise),
      mockRunnerService(null),
      mockAttemptService(attemptResult),
      mockEnsureStudent('stu-1'),
      mockResultRepo([{ pointsEarned: 100 }]),
    );
    const res = await svc.submit('user-1', { exerciseId: 'ex-1', exerciseVersion: 1, answer: ['a'] });
    expect(res.passed).toBe(true);
    expect(res.pointsAwarded).toBe(100);
    expect(res.totalPoints).toBe(100);
  });

  it('MC: wrong answer returns failed + 0 points', async () => {
    const failResult = {
      attempt: { id: 'att-2', pointsAwarded: 0 },
      exerciseResult: { pointsEarned: 0, attemptsCount: 1, passed: false },
    };
    const svc = new SubmissionService(
      mockExerciseRepo(mcExercise),
      mockRunnerService(null),
      mockAttemptService(failResult),
      mockEnsureStudent('stu-1'),
      mockResultRepo([]),
    );
    const res = await svc.submit('user-1', { exerciseId: 'ex-1', exerciseVersion: 1, answer: ['b'] });
    expect(res.passed).toBe(false);
    expect(res.pointsAwarded).toBe(0);
  });

  it('code: delegates to RunnerService and passes result', async () => {
    const runResult = { exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, durationMs: 100 };
    const svc = new SubmissionService(
      mockExerciseRepo(codeExercise),
      mockRunnerService(runResult),
      mockAttemptService(attemptResult),
      mockEnsureStudent('stu-1'),
      mockResultRepo([{ pointsEarned: 100 }]),
    );
    const res = await svc.submit('user-1', { exerciseId: 'ex-2', exerciseVersion: 1, code: 'func f() {}' });
    expect(res.passed).toBe(true);
    expect(res.outcome).toBe('passed');
    expect(res.stdout).toBe('ok');
  });

  it('throws NotFoundException for missing exercise', async () => {
    const svc = new SubmissionService(
      mockExerciseRepo(null),
      mockRunnerService(null),
      mockAttemptService(null),
      mockEnsureStudent('stu-1'),
      mockResultRepo([]),
    );
    await expect(svc.submit('user-1', { exerciseId: 'x', exerciseVersion: 1, answer: [] }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for unpublished exercise', async () => {
    const svc = new SubmissionService(
      mockExerciseRepo({ ...mcExercise, publishedAt: null }),
      mockRunnerService(null),
      mockAttemptService(null),
      mockEnsureStudent('stu-1'),
      mockResultRepo([]),
    );
    await expect(svc.submit('user-1', { exerciseId: 'ex-1', exerciseVersion: 1, answer: [] }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('auto-creates student via ensureStudent', async () => {
    const ensure = mockEnsureStudent('stu-new');
    const svc = new SubmissionService(
      mockExerciseRepo(mcExercise),
      mockRunnerService(null),
      mockAttemptService(attemptResult),
      ensure,
      mockResultRepo([]),
    );
    await svc.submit('user-1', { exerciseId: 'ex-1', exerciseVersion: 1, answer: ['a'] });
    expect(ensure.ensureStudent).toHaveBeenCalledWith('user-1');
  });
});
```

- [ ] **Step 2: Implement SubmissionService**

Create `platform/src/submission/submission.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { RunnerService } from '../execution/runner.service';
import { AttemptService } from '../state/services/attempt.service';
import { EnsureStudentService } from './ensure-student';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { ExercisePayload } from '../content/types/exercise-payload.types';
import { SubmissionPayload } from '../content/types/submission-payload.types';
import { RunOutcome } from '../execution/types';
import { serverCheck } from './server-check';

export type SubmitRequest = {
  exerciseId: string;
  exerciseVersion: number;
  code?: string;
  answer?: unknown;
};

export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: RunOutcome;
  stdout?: string;
  stderr?: string;
};

@Injectable()
export class SubmissionService {
  constructor(
    private readonly exercises: ExerciseRepository,
    private readonly runner: RunnerService,
    private readonly attempts: AttemptService,
    private readonly ensureStudentSvc: EnsureStudentService,
    private readonly results: ExerciseResultRepository,
  ) {}

  async submit(userId: string, req: SubmitRequest): Promise<SubmitResponse> {
    const exercise = await this.exercises.findByVersion(req.exerciseId, req.exerciseVersion);
    if (!exercise || exercise.publishedAt === null) {
      throw new NotFoundException({ error: 'not_found' });
    }

    const payload = exercise.payload as unknown as ExercisePayload;
    const student = await this.ensureStudentSvc.ensureStudent(userId);

    let passed: boolean;
    let outcome: RunOutcome | undefined;
    let stdout: string | undefined;
    let stderr: string | undefined;

    if (payload.type === 'code' || payload.type === 'fix_bug') {
      if (!req.code && req.code !== '') {
        throw new NotFoundException({ error: 'code_required' });
      }
      // Delegate to RunnerService which handles harness building, docker exec, and queue
      const runResponse = await this.runner.run({
        exerciseId: req.exerciseId,
        exerciseVersion: req.exerciseVersion,
        code: req.code!,
      });
      outcome = runResponse.outcome;
      stdout = runResponse.stdout;
      stderr = runResponse.stderr;
      passed = runResponse.passed;
    } else {
      const checkResult = serverCheck(payload, req.answer);
      passed = checkResult.passed;
    }

    const submissionPayload = this.buildSubmissionPayload(payload.type, req);

    const { attempt, exerciseResult } = await this.attempts.recordAttempt({
      studentId: student.id,
      exerciseId: req.exerciseId,
      exerciseVersion: req.exerciseVersion,
      submissionPayload,
      passed,
      hintsUsedCount: 0,
    });

    const allResults = await this.results.listByStudent(student.id);
    const totalPoints = allResults.reduce((sum, r) => sum + r.pointsEarned, 0);

    return {
      passed,
      pointsAwarded: attempt.pointsAwarded,
      totalPointsExercise: exerciseResult.pointsEarned,
      totalPoints,
      outcome,
      stdout,
      stderr,
    };
  }

  private buildSubmissionPayload(type: string, req: SubmitRequest): SubmissionPayload {
    switch (type) {
      case 'code':
        return { type: 'code', code: req.code ?? '' };
      case 'fix_bug':
        return { type: 'fix_bug', code: req.code ?? '' };
      case 'multiple_choice':
        return { type: 'multiple_choice', selectedOptionIds: (req.answer as string[]) ?? [] };
      case 'fill_blank':
        return { type: 'fill_blank', blanks: (req.answer as Record<string, string>) ?? {} };
      case 'predict_output':
        return { type: 'predict_output', answer: String(req.answer ?? '') };
      default:
        throw new Error(`Unknown exercise type: ${type}`);
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest submission.service -i
```
Expected: 6 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/submission/submission.service.ts test/submission/submission.service.spec.ts
git commit -m "feat: add submission service orchestrating grading flow"
```

---

## Task 4: SubmitController + ProgressController + SubmissionModule

**Files:**
- Create: `platform/src/submission/submit.controller.ts`
- Create: `platform/src/submission/progress.controller.ts`
- Create: `platform/src/submission/submission.module.ts`
- Modify: `platform/src/app.module.ts`
- Create: `platform/test/submission/submit.controller.spec.ts`
- Create: `platform/test/submission/progress.controller.spec.ts`

- [ ] **Step 1: Create SubmitController**

Create `platform/src/submission/submit.controller.ts`:

```ts
import {
  Body, Controller, HttpCode, Post, UseGuards, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmissionService, SubmitResponse } from './submission.service';

class SubmitDto {
  @IsString() @MinLength(1) exerciseId!: string;
  @IsInt() exerciseVersion!: number;
  @IsOptional() @IsString() code?: string;
  @IsOptional() answer?: unknown;
}

@Controller('api/submit')
export class SubmitController {
  constructor(private readonly submission: SubmissionService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false }))
  async submit(
    @Body() dto: SubmitDto,
    @CurrentUser() user: { userId: string },
  ): Promise<SubmitResponse> {
    return this.submission.submit(user.userId, {
      exerciseId: dto.exerciseId,
      exerciseVersion: dto.exerciseVersion,
      code: dto.code,
      answer: dto.answer,
    });
  }
}
```

Note: `whitelist: false` because `answer` is `unknown` (arbitrary JSON).

- [ ] **Step 2: Create ProgressController**

Create `platform/src/submission/progress.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { StudentRepository } from '../state/repositories/student.repository';

@Controller('api/progress')
export class ProgressController {
  constructor(
    private readonly results: ExerciseResultRepository,
    private readonly students: StudentRepository,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myProgress(@CurrentUser() user: { userId: string }) {
    const student = await this.students.findByUserId(user.userId);
    if (!student) {
      return { studentId: null, results: [], totalPoints: 0 };
    }
    const allResults = await this.results.listByStudent(student.id);
    const totalPoints = allResults.reduce((sum, r) => sum + r.pointsEarned, 0);
    return {
      studentId: student.id,
      results: allResults.map((r) => ({
        exerciseId: r.exerciseId,
        passed: r.passed,
        pointsEarned: r.pointsEarned,
        attemptsCount: r.attemptsCount,
        firstPassedAt: r.firstPassedAt,
      })),
      totalPoints,
    };
  }
}
```

- [ ] **Step 3: Create SubmissionModule**

Create `platform/src/submission/submission.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { ExecutionModule } from '../execution/execution.module';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { SubmitController } from './submit.controller';
import { ProgressController } from './progress.controller';
import { SubmissionService } from './submission.service';
import { EnsureStudentService } from './ensure-student';

@Module({
  imports: [ContentModule, ExecutionModule, StateModule, AuthModule],
  controllers: [SubmitController, ProgressController],
  providers: [SubmissionService, EnsureStudentService],
})
export class SubmissionModule {}
```

- [ ] **Step 4: Wire into AppModule**

Add `SubmissionModule` to `src/app.module.ts` imports.

- [ ] **Step 5: Write SubmitController e2e test**

Create `platform/test/submission/submit.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('SubmitController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exercises: ExerciseRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({
        run: jest.fn().mockResolvedValue({
          stdout: 'ok\n', stderr: '', exitCode: 0, timedOut: false, durationMs: 100,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = moduleRef.get(PrismaService);
    exercises = moduleRef.get(ExerciseRepository);
  });

  beforeEach(async () => { await resetDb(prisma); });
  afterAll(async () => { await app.close(); });

  async function registerUser() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `sub${Date.now()}@test.com`, name: 'Sub', password: 'password123' });
    return res.headers['set-cookie'];
  }

  async function seedMcExercise() {
    const id = newId();
    await exercises.createDraft({
      id, lessonId: newId(), promptMarkdown: 'q', type: 'multiple_choice',
      payload: {
        type: 'multiple_choice', questionMarkdown: 'q?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'], multiSelect: false,
      },
      pointsMax: 100, hints: [], concepts: [],
    });
    await exercises.publish(id, 1);
    return id;
  }

  it('POST /api/submit 200 for correct MC answer', async () => {
    const cookies = await registerUser();
    const exId = await seedMcExercise();
    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookies)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.pointsAwarded).toBe(100);
    expect(res.body.totalPoints).toBe(100);
  });

  it('POST /api/submit 200 for wrong MC answer', async () => {
    const cookies = await registerUser();
    const exId = await seedMcExercise();
    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookies)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['b'] });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(false);
    expect(res.body.pointsAwarded).toBe(0);
  });

  it('POST /api/submit 401 without auth', async () => {
    const exId = await seedMcExercise();
    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] });
    expect(res.status).toBe(401);
  });

  it('POST /api/submit 404 for missing exercise', async () => {
    const cookies = await registerUser();
    const res = await request(app.getHttpServer())
      .post('/api/submit')
      .set('Cookie', cookies)
      .send({ exerciseId: newId(), exerciseVersion: 1, answer: [] });
    expect(res.status).toBe(404);
  });

  it('scoring penalizes failed attempts', async () => {
    const cookies = await registerUser();
    const exId = await seedMcExercise();
    // Fail first
    await request(app.getHttpServer())
      .post('/api/submit').set('Cookie', cookies)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['b'] });
    // Then pass
    const res = await request(app.getHttpServer())
      .post('/api/submit').set('Cookie', cookies)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] });
    expect(res.body.passed).toBe(true);
    expect(res.body.pointsAwarded).toBe(95); // 100 - 5% * 1 fail = 95
    expect(res.body.totalPointsExercise).toBe(95);
  });
});
```

- [ ] **Step 6: Write ProgressController e2e test**

Create `platform/test/submission/progress.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let exercises: ExerciseRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = moduleRef.get(PrismaService);
    exercises = moduleRef.get(ExerciseRepository);
  });

  beforeEach(async () => { await resetDb(prisma); });
  afterAll(async () => { await app.close(); });

  it('GET /api/progress/me returns empty for new user', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'prog@test.com', name: 'P', password: 'password123' });
    const cookies = reg.headers['set-cookie'];
    const res = await request(app.getHttpServer())
      .get('/api/progress/me').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBeNull();
    expect(res.body.results).toEqual([]);
    expect(res.body.totalPoints).toBe(0);
  });

  it('GET /api/progress/me returns results after submission', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'prog2@test.com', name: 'P2', password: 'password123' });
    const cookies = reg.headers['set-cookie'];

    const exId = newId();
    await exercises.createDraft({
      id: exId, lessonId: newId(), promptMarkdown: 'q', type: 'multiple_choice',
      payload: {
        type: 'multiple_choice', questionMarkdown: 'q?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'], multiSelect: false,
      },
      pointsMax: 100, hints: [], concepts: [],
    });
    await exercises.publish(exId, 1);

    await request(app.getHttpServer())
      .post('/api/submit').set('Cookie', cookies)
      .send({ exerciseId: exId, exerciseVersion: 1, answer: ['a'] });

    const res = await request(app.getHttpServer())
      .get('/api/progress/me').set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBeTruthy();
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].passed).toBe(true);
    expect(res.body.results[0].pointsEarned).toBe(100);
    expect(res.body.totalPoints).toBe(100);
  });

  it('GET /api/progress/me returns 401 without auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/progress/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```
Expected: all prior 111 tests + new tests. Should be ~130 total.

- [ ] **Step 8: Commit**

```bash
git add src/submission/submit.controller.ts src/submission/progress.controller.ts src/submission/submission.module.ts src/app.module.ts test/submission/submit.controller.spec.ts test/submission/progress.controller.spec.ts
git commit -m "feat: add submit and progress controllers with grading pipeline"
```

---

## Task 5: Web — lib/submit.ts client + PointsBadge

**Files:**
- Create: `web/lib/submit.ts`
- Create: `web/components/lesson/renderers/PointsBadge.tsx`
- Create: `web/tests/submit.test.ts`
- Create: `web/tests/renderers/PointsBadge.test.tsx`

- [ ] **Step 1: Create submit client**

Create `web/lib/submit.ts`:

```ts
export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: string;
  stdout?: string;
  stderr?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export async function submitExercise(
  exerciseId: string,
  exerciseVersion: number,
  payload: { code: string } | { answer: unknown },
): Promise<SubmitResponse> {
  try {
    const res = await fetch(`${BASE}/api/submit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId, exerciseVersion, ...payload }),
    });
    if (!res.ok) {
      throw new Error(`submit returned ${res.status}`);
    }
    return (await res.json()) as SubmitResponse;
  } catch (err) {
    return {
      passed: false,
      pointsAwarded: 0,
      totalPointsExercise: 0,
      totalPoints: 0,
      outcome: 'internal_error',
      stderr: `could not reach submission service: ${(err as Error).message}`,
    };
  }
}
```

- [ ] **Step 2: Create PointsBadge**

Create `web/components/lesson/renderers/PointsBadge.tsx`:

```tsx
export function PointsBadge({
  passed,
  pointsAwarded,
  totalPoints,
}: {
  passed: boolean;
  pointsAwarded: number;
  totalPoints: number;
}) {
  if (passed) {
    return (
      <span className="text-sm font-medium text-green-700 dark:text-green-300">
        +{pointsAwarded} points ({totalPoints} total)
      </span>
    );
  }
  return (
    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
      0 points this attempt ({totalPoints} total)
    </span>
  );
}
```

- [ ] **Step 3: Write tests**

Create `web/tests/submit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitExercise } from '@/lib/submit';

describe('submitExercise', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { (global as any).fetch = vi.fn(); });
  afterEach(() => { (global as any).fetch = originalFetch; });

  it('returns submit response on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ passed: true, pointsAwarded: 100, totalPointsExercise: 100, totalPoints: 100 }),
    });
    const res = await submitExercise('ex-1', 1, { answer: ['a'] });
    expect(res.passed).toBe(true);
    expect(res.pointsAwarded).toBe(100);
  });

  it('returns synthetic error on failure', async () => {
    (global.fetch as any).mockRejectedValue(new TypeError('fetch failed'));
    const res = await submitExercise('ex-1', 1, { answer: [] });
    expect(res.passed).toBe(false);
    expect(res.outcome).toBe('internal_error');
  });
});
```

Create `web/tests/renderers/PointsBadge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PointsBadge } from '@/components/lesson/renderers/PointsBadge';

describe('PointsBadge', () => {
  it('shows +N points on pass', () => {
    render(<PointsBadge passed={true} pointsAwarded={100} totalPoints={250} />);
    expect(screen.getByText(/\+100 points/)).toBeInTheDocument();
    expect(screen.getByText(/250 total/)).toBeInTheDocument();
  });

  it('shows 0 points on fail', () => {
    render(<PointsBadge passed={false} pointsAwarded={0} totalPoints={150} />);
    expect(screen.getByText(/0 points this attempt/)).toBeInTheDocument();
    expect(screen.getByText(/150 total/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd c:/Users/ricma/BootCamp/web && npm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/submit.ts components/lesson/renderers/PointsBadge.tsx tests/submit.test.ts tests/renderers/PointsBadge.test.tsx
git commit -m "feat: add submit client and points badge"
```

---

## Task 6: Web — Update renderers to use Submit

**Files:**
- Modify: `web/components/lesson/renderers/MultipleChoiceExercise.tsx`
- Modify: `web/components/lesson/renderers/FillBlankExercise.tsx`
- Modify: `web/components/lesson/renderers/PredictOutputExercise.tsx`
- Modify: `web/components/lesson/renderers/CodeExercise.tsx`
- Modify: `web/components/lesson/renderers/FixBugExercise.tsx`
- Modify: corresponding test files

**MC/Fill/Predict changes:**
- Replace `checkAnswer()` (client-side) with `submitExercise()` (server-side)
- Rename button from "Check" to "Submit"
- Add `PointsBadge` to the result display
- Add auth check: if `useAuth().user === null`, show "Sign in to submit"
- Import `submitExercise` from `@/lib/submit`, `PointsBadge` from `./PointsBadge`, `useAuth` from `@/components/layout/AuthProvider`

**Code/FixBug changes:**
- Keep existing "Run tests" button (ephemeral, calls `runExercise`)
- Add new "Submit" button next to it (calls `submitExercise` with `{code}`)
- Show `RunResult` for stdout/stderr (from either Run or Submit) + `PointsBadge` (from Submit only)
- Both buttons need auth check; "Submit" shows "Sign in to submit", "Run" shows "Sign in to run code" (existing)
- Use separate state: `runResult` for Run and `submitResult` for Submit. Display whichever was last used.

**Update tests:**
- MC/Fill/Predict tests: mock `@/lib/submit` instead of `@/lib/check`, verify Submit button calls `submitExercise`, add PointsBadge assertion
- Code/FixBug tests: add test for Submit button calling `submitExercise` and showing points

- [ ] **Step 1: Update all 5 renderers**

Read each renderer, apply the changes above. For MC/Fill/Predict, remove the `import { checkAnswer }` and replace with `import { submitExercise }` from `@/lib/submit`. For Code/FixBug, add the Submit button alongside Run.

- [ ] **Step 2: Update all 5 test files**

Update mocks and assertions.

- [ ] **Step 3: Run tests and build**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add components/lesson/renderers/ tests/renderers/
git commit -m "feat: wire submit button with grading in all renderers"
```

---

## Task 7: Web — Header points counter + delete check.ts

**Files:**
- Modify: `web/components/layout/AppShell.tsx`
- Delete: `web/lib/check.ts`
- Modify: `web/tests/check.test.ts` (delete)

- [ ] **Step 1: Add points counter to AppShell**

Read `web/components/layout/AppShell.tsx`. Add a small points indicator next to Settings:

```tsx
// Inside AppShell, next to <SettingsMenu />:
{user && <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{totalPoints} pts</span>}
```

The points value can come from a new state that's updated via the submit response. Simplest approach: add a `totalPoints` state to `AuthProvider` context or create a lightweight `ProgressProvider`. For this spec, simplest: add `totalPoints` and `setTotalPoints` to the AuthProvider context. After each submit, the renderer calls `setTotalPoints(response.totalPoints)`. On initial load, fetch from `/api/progress/me`.

Update `AuthProvider`:
- Add `totalPoints: number` and `setTotalPoints: (n: number) => void` to context
- On mount (after `fetchMe` succeeds), also fetch progress and set `totalPoints`
- Expose `setTotalPoints` so renderers can update it after submit

- [ ] **Step 2: Delete check.ts and its test**

```bash
rm web/lib/check.ts web/tests/check.test.ts
```

Verify no imports remain that reference `@/lib/check`.

- [ ] **Step 3: Run tests and build**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: header points counter, remove client-side check"
```

---

## Task 8: Playwright smoke + final verification

**Files:**
- Modify: `web/tests/e2e/lesson.spec.ts`

- [ ] **Step 1: Add grading smoke test**

Append to `web/tests/e2e/lesson.spec.ts`:

```ts
test.skip('grading: submit MC, see points, submit code, cumulative', async ({ page }) => {
  // Register
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`grade${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Grader');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');

  // Submit correct MC
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=1');
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/\+.*points/i)).toBeVisible({ timeout: 10_000 });

  // Header should show points
  await expect(page.getByText(/pts/i)).toBeVisible();
});
```

- [ ] **Step 2: Run full platform suite**

```bash
cd c:/Users/ricma/BootCamp/platform && npm test
```

- [ ] **Step 3: Run full web suite**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

- [ ] **Step 4: Verify Playwright list**

```bash
npx playwright test --list
```

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/web
git add tests/e2e/lesson.spec.ts
git commit -m "test: add grading playwright smoke"
```

- [ ] **Step 6: Update HANDOVER.md**

Update `docs/superpowers/HANDOVER.md` with spec #5 status, new endpoints, test counts, and spec #6 as next target.
