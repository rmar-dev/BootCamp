# Lesson Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor BootCamp's lesson page into a full-bleed linear player with a per-lesson hex bar (earn-on-perfection), AI-review SSE streaming, and renderer/test cleanup. Two-repo work: platform first, web second.

**Architecture:** Platform exposes a new `attemptStatus` field per exercise + a `newAttemptStatus` field on the submit response, both computed from the existing `Attempt` table version-scoped. A new SSE endpoint server-side-streams the AI review markdown that the existing review pipeline writes to `CodeReview`. Web introduces a route-group split (`(authed)/(shell)` for the existing pages, `(authed)/(immersive)` for the full-bleed lesson), a `LessonPlayerShell` client component that owns step state via `?step=N`, and refactored renderers that bubble pass-state up via an `onAttempt` callback.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL on the platform side. Next.js 14 App Router + Tailwind + Vitest + Playwright on the web side. Co-author trailer for every commit: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

**Spec:** [docs/superpowers/specs/2026-05-04-lesson-player-design.md](../specs/2026-05-04-lesson-player-design.md)

---

## Phase 0 — Worktree setup

### Task 1: Create platform worktree on `feat/lesson-payload`

**Files:** none (git operation only)

- [ ] **Step 1: Create worktree**

```powershell
git -C c:/Users/ricma/BootCamp/platform worktree add -b feat/lesson-payload c:/tmp/bootcamp-platform-lesson origin/master
```

Expected: new worktree at `c:/tmp/bootcamp-platform-lesson` on branch `feat/lesson-payload`.

- [ ] **Step 2: Verify branch base SHA**

```powershell
git -C c:/tmp/bootcamp-platform-lesson rev-parse HEAD
```

Expected: `a376a48...` (platform master per spec).

- [ ] **Step 3: Install dependencies in worktree**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npm install
```

Expected: install completes without errors. node_modules ready for tests.

---

## Phase 1 — Platform changes (`feat/lesson-payload`)

All Phase 1 work happens in `c:/tmp/bootcamp-platform-lesson`.

### Task 2: Define `ExerciseAttemptStatus` type and extend `ExerciseDTO`

**Files:**
- Create: `c:/tmp/bootcamp-platform-lesson/src/content/types/attempt-status.ts`
- Modify: `c:/tmp/bootcamp-platform-lesson/src/content/services/lesson-assembler.service.ts` (export type at top)

- [ ] **Step 1: Create the new type module**

```ts
// src/content/types/attempt-status.ts
export type ExerciseAttemptStatus = 'unattempted' | 'first_try' | 'eventual';
```

- [ ] **Step 2: Extend `ExerciseDTO` to carry `attemptStatus`**

In `src/content/services/lesson-assembler.service.ts`, replace the `ExerciseDTO` declaration:

```ts
import { ExerciseAttemptStatus } from '../types/attempt-status';

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
  attemptStatus: ExerciseAttemptStatus;
};
```

- [ ] **Step 3: Run tsc to confirm no callers break**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx tsc --noEmit
```

Expected: compile errors in the lesson-assembler about missing `attemptStatus` on the constructed DTOs (these errors are intentional — Task 4 fills them in).

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/content/types/attempt-status.ts src/content/services/lesson-assembler.service.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(content): add ExerciseAttemptStatus type and extend ExerciseDTO

Adds the per-exercise attempt status field that the web lesson player
will use to fill its per-lesson hex bar. No computation yet — Task 4
wires it into the assembler. tsc intentionally fails on assembler
construct sites until then.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3: Add `computeStatus` helper with unit tests

**Files:**
- Create: `c:/tmp/bootcamp-platform-lesson/src/content/services/attempt-status.util.ts`
- Test: `c:/tmp/bootcamp-platform-lesson/src/content/services/attempt-status.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/services/attempt-status.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { computeStatus } from './attempt-status.util';

describe('computeStatus', () => {
  it('returns unattempted for empty input', () => {
    expect(computeStatus([])).toBe('unattempted');
  });

  it('returns first_try when earliest attempt passed', () => {
    expect(computeStatus([{ passed: true }])).toBe('first_try');
    expect(computeStatus([{ passed: true }, { passed: false }])).toBe('first_try');
    expect(computeStatus([{ passed: true }, { passed: true }])).toBe('first_try');
  });

  it('returns eventual when earliest attempt failed but a later one passed', () => {
    expect(computeStatus([{ passed: false }, { passed: true }])).toBe('eventual');
    expect(computeStatus([{ passed: false }, { passed: false }, { passed: true }])).toBe('eventual');
  });

  it('returns unattempted when all attempts failed (treated as not-yet-passed)', () => {
    expect(computeStatus([{ passed: false }])).toBe('unattempted');
    expect(computeStatus([{ passed: false }, { passed: false }])).toBe('unattempted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest src/content/services/attempt-status.util.spec.ts
```

Expected: FAIL — `Cannot find module './attempt-status.util'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/content/services/attempt-status.util.ts
import { ExerciseAttemptStatus } from '../types/attempt-status';

export function computeStatus(rows: ReadonlyArray<{ passed: boolean }>): ExerciseAttemptStatus {
  if (rows.length === 0) return 'unattempted';
  if (rows[0].passed) return 'first_try';
  if (rows.some((r) => r.passed)) return 'eventual';
  return 'unattempted';
}
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest src/content/services/attempt-status.util.spec.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/content/services/attempt-status.util.ts src/content/services/attempt-status.util.spec.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(content): add computeStatus helper for attemptStatus

Pure function over an ordered list of attempts (earliest first by
submittedAt). Returns first_try when the earliest attempt passed,
eventual when an earlier attempt failed before a passing one,
unattempted otherwise. Used by Task 4 (assembler) and Task 6
(submission service).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Wire `computeStatus` into `LessonAssemblerService`

**Files:**
- Modify: `c:/tmp/bootcamp-platform-lesson/src/content/services/lesson-assembler.service.ts`
- Modify: `c:/tmp/bootcamp-platform-lesson/src/content/lesson.controller.ts`
- Test: existing `c:/tmp/bootcamp-platform-lesson/test/lesson.controller.spec.ts` (extend)

- [ ] **Step 1: Add the assembler refactor — accept studentId, query attempts, fill status**

In `src/content/services/lesson-assembler.service.ts`:

```ts
// Top of file — add imports
import { PrismaService } from '../../prisma/prisma.service';
import { ExerciseAttemptStatus } from '../types/attempt-status';
import { computeStatus } from './attempt-status.util';

// Add PrismaService to constructor:
constructor(
  private readonly lessons: LessonRepository,
  private readonly exercises: ExerciseRepository,
  private readonly prisma: PrismaService,
) {}

// Add the new variant; keep the existing zero-student variants for preview/version paths.
async assembleLatestForStudent(
  id: string,
  assignmentState: LessonAssignmentState,
  studentId: string,
): Promise<LessonResponseDTO | null> {
  const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
  if (!lesson) return null;
  return this.toResponseWithAssignment(lesson, assignmentState, studentId);
}

// Refactor toResponseWithAssignment to accept optional studentId, default to 'unattempted' when absent.
private async toResponseWithAssignment(
  lesson: NonNullable<Awaited<ReturnType<LessonRepository['findLatestPublishedWithBlocks']>>>,
  assignment: LessonAssignmentState | null,
  studentId?: string,
): Promise<LessonResponseDTO> {
  const allowedExerciseIds =
    assignment?.status === 'active'
      ? new Set(assignment.selectedExerciseIds)
      : null;

  const blocks: LessonBlockDTO[] = [];
  const exerciseRefs: { id: string; version: number }[] = [];

  for (const block of lesson.blocks) {
    if (block.kind === 'explanation') {
      blocks.push({ kind: 'explanation', id: block.id, markdown: block.explanationMarkdown ?? '' });
      continue;
    }
    if (!block.exerciseId || block.exerciseVersion == null) {
      this.logger.warn(`Exercise block ${block.id} in lesson ${lesson.id} v${lesson.version} has missing exerciseId or exerciseVersion — skipping`);
      continue;
    }
    if (allowedExerciseIds && !allowedExerciseIds.has(block.exerciseId)) continue;
    const ex = await this.exercises.findByVersion(block.exerciseId, block.exerciseVersion);
    if (!ex || ex.publishedAt === null) {
      this.logger.warn(`Exercise block ${block.id} in lesson ${lesson.id} v${lesson.version} references unpublished or missing exercise ${block.exerciseId} v${block.exerciseVersion} — skipping`);
      continue;
    }
    exerciseRefs.push({ id: ex.id, version: ex.version });
    blocks.push({
      kind: 'exercise',
      id: block.id,
      exercise: {
        id: ex.id,
        version: ex.version,
        type: ex.type as ExerciseTypeValue,
        promptMarkdown: ex.promptMarkdown,
        pointsMax: ex.pointsMax,
        payload: ex.payload as ExercisePayload,
        attemptStatus: 'unattempted',  // overwritten below when studentId provided
      },
    });
  }

  if (studentId && exerciseRefs.length > 0) {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        studentId,
        OR: exerciseRefs.map((r) => ({ exerciseId: r.id, exerciseVersion: r.version })),
      },
      orderBy: { submittedAt: 'asc' },
      select: { exerciseId: true, exerciseVersion: true, passed: true },
    });
    const byKey = new Map<string, { passed: boolean }[]>();
    for (const a of attempts) {
      const key = `${a.exerciseId}@${a.exerciseVersion}`;
      const list = byKey.get(key) ?? [];
      list.push({ passed: a.passed });
      byKey.set(key, list);
    }
    for (const block of blocks) {
      if (block.kind !== 'exercise') continue;
      const key = `${block.exercise.id}@${block.exercise.version}`;
      block.exercise.attemptStatus = computeStatus(byKey.get(key) ?? []);
    }
  }

  return {
    id: lesson.id,
    version: lesson.version,
    title: lesson.title,
    trackId: lesson.trackId,
    blocks,
    assignment,
  };
}
```

- [ ] **Step 2: Update `LessonController.getLatest` to pass `studentId`**

In `src/content/lesson.controller.ts`:

```ts
const result = await this.assembler.assembleLatestForStudent(id, dtoState, studentId);
```

(replaces the existing `assembleLatestForStudent(id, dtoState)` call). Same change in `revisit()` route — pass `studentId`.

- [ ] **Step 3: Update `ContentModule` to provide `PrismaService` to the assembler**

Verify `src/content/content.module.ts` imports `PrismaModule` (or that `PrismaService` is otherwise available). If not, add `imports: [PrismaModule]` and `PrismaService` is auto-injected.

```powershell
grep -n "PrismaModule\|PrismaService" c:/tmp/bootcamp-platform-lesson/src/content/content.module.ts
```

If absent, add `import { PrismaModule } from '../prisma/prisma.module'` and include it in the `imports` array.

- [ ] **Step 4: Extend `lesson.controller.spec.ts` to assert `attemptStatus`**

Append to `test/lesson.controller.spec.ts`:

```ts
it('returns attemptStatus on each exercise block, computed from Attempt history', async () => {
  // Given a lesson with two exercise blocks
  // and a student with: ex1 passed first try, ex2 failed once then passed
  // Expected: blocks[0].exercise.attemptStatus === 'first_try'
  //           blocks[1].exercise.attemptStatus === 'eventual'

  const studentId = await seedStudent();   // helper from existing spec
  const lessonId = await seedTwoExerciseLesson();   // helper from existing spec
  const [ex1Id, ex2Id] = await getLessonExerciseIds(lessonId);

  await prisma.attempt.create({ data: { id: newId(), studentId, exerciseId: ex1Id, exerciseVersion: 1, submissionPayload: {} as any, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 100 } });
  await prisma.attempt.create({ data: { id: newId(), studentId, exerciseId: ex2Id, exerciseVersion: 1, submissionPayload: {} as any, passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0 } });
  await prisma.attempt.create({ data: { id: newId(), studentId, exerciseId: ex2Id, exerciseVersion: 1, submissionPayload: {} as any, passed: true, hintsUsedCount: 0, failedAttemptsBefore: 1, pointsAwarded: 50 } });

  const res = await request(app.getHttpServer())
    .get(`/api/lessons/${lessonId}`)
    .set('Cookie', authCookie(studentId));
  expect(res.status).toBe(200);
  const exerciseBlocks = res.body.blocks.filter((b: any) => b.kind === 'exercise');
  expect(exerciseBlocks[0].exercise.attemptStatus).toBe('first_try');
  expect(exerciseBlocks[1].exercise.attemptStatus).toBe('eventual');
});
```

If the existing spec doesn't have `seedStudent`, `seedTwoExerciseLesson`, or `authCookie` helpers, adapt to whatever fixture pattern that file already uses — the test's intent is what matters.

- [ ] **Step 5: Run all platform tests**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npm run test
```

Expected: all green.

- [ ] **Step 6: Run tsc to confirm clean**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/content/services/lesson-assembler.service.ts src/content/lesson.controller.ts src/content/content.module.ts test/lesson.controller.spec.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(content): compute per-exercise attemptStatus in lesson DTO

Adds studentId-aware assembler path that bulk-queries the Attempt
table for the lesson's (exerciseId, version) refs, sorts by
submittedAt, and runs computeStatus per block. Preview / version
paths default attemptStatus to 'unattempted'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Add `newAttemptStatus` to `SubmitResponse`

**Files:**
- Modify: `c:/tmp/bootcamp-platform-lesson/src/submission/submission.service.ts`
- Test: existing submission tests in `c:/tmp/bootcamp-platform-lesson/test/submission/`

- [ ] **Step 1: Find a representative existing submission test**

```powershell
ls c:/tmp/bootcamp-platform-lesson/test/submission/
```

Pick the most representative spec (likely `submission.service.spec.ts` or an integration test). Read it so the new test follows that pattern.

- [ ] **Step 2: Write the failing test**

Append to the chosen spec file:

```ts
it('returns newAttemptStatus = first_try when student passes on the first attempt', async () => {
  const { studentId, exerciseId, exerciseVersion } = await seedStudentAndExercise();
  const res = await service.submit('user-1', {
    exerciseId, exerciseVersion, code: passingCode,
  });
  expect(res.passed).toBe(true);
  expect(res.newAttemptStatus).toBe('first_try');
});

it('returns newAttemptStatus = eventual when student passes after a prior failure', async () => {
  const { studentId, exerciseId, exerciseVersion } = await seedStudentAndExercise();
  await service.submit('user-1', { exerciseId, exerciseVersion, code: failingCode });
  const res = await service.submit('user-1', { exerciseId, exerciseVersion, code: passingCode });
  expect(res.passed).toBe(true);
  expect(res.newAttemptStatus).toBe('eventual');
});

it('returns newAttemptStatus = unattempted when the submission failed', async () => {
  const { exerciseId, exerciseVersion } = await seedStudentAndExercise();
  const res = await service.submit('user-1', { exerciseId, exerciseVersion, code: failingCode });
  expect(res.passed).toBe(false);
  expect(res.newAttemptStatus).toBe('unattempted');
});
```

Adapt seeders to the file's existing fixture pattern.

- [ ] **Step 3: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest test/submission/
```

Expected: FAIL — `newAttemptStatus` does not exist on the response shape.

- [ ] **Step 4: Implement — extend SubmitResponse and compute on submit**

In `src/submission/submission.service.ts`:

```ts
// Top of file — add imports
import { ExerciseAttemptStatus } from '../content/types/attempt-status';
import { computeStatus } from '../content/services/attempt-status.util';
import { PrismaService } from '../prisma/prisma.service';

// Extend SubmitResponse:
export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: string;
  stdout?: string;
  stderr?: string;
  newBadges: BadgeDefinition[];
  attemptId: string;
  newAttemptStatus: ExerciseAttemptStatus;
};

// Add PrismaService to constructor:
constructor(
  private readonly exercises: ExerciseRepository,
  private readonly runner: RunnerService,
  private readonly attemptService: AttemptService,
  private readonly ensureStudentSvc: EnsureStudentService,
  private readonly results: ExerciseResultRepository,
  private readonly badgeService: BadgeService,
  private readonly reviewService: ReviewService,
  private readonly reviewQueueService: ReviewQueueService,
  private readonly prisma: PrismaService,
) {}

// Inside submit(), after recordAttempt and before the return:
const versionScopedAttempts = await this.prisma.attempt.findMany({
  where: { studentId, exerciseId: req.exerciseId, exerciseVersion: req.exerciseVersion },
  orderBy: { submittedAt: 'asc' },
  select: { passed: true },
});
const newAttemptStatus = computeStatus(versionScopedAttempts);

// Add to the return object:
return {
  passed,
  pointsAwarded: attempt.pointsAwarded,
  totalPointsExercise: exerciseResult.pointsEarned,
  totalPoints,
  outcome,
  stdout,
  stderr,
  newBadges,
  attemptId: attempt.id,
  newAttemptStatus,
};
```

If `submission.module.ts` does not already import `PrismaModule`, add it.

- [ ] **Step 5: Run tests to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npm run test
```

Expected: all green, including the three new tests.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/submission/submission.service.ts src/submission/submission.module.ts test/submission/
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(submission): return newAttemptStatus on SubmitResponse

After persisting the attempt, the service queries version-scoped
attempts and runs computeStatus to return the post-insert state.
Lets the web client update the hex bar without re-fetching the
lesson.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Add `chunkMarkdown` utility

**Files:**
- Create: `c:/tmp/bootcamp-platform-lesson/src/review/chunk-markdown.util.ts`
- Test: `c:/tmp/bootcamp-platform-lesson/src/review/chunk-markdown.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/review/chunk-markdown.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { chunkMarkdown } from './chunk-markdown.util';

describe('chunkMarkdown', () => {
  it('returns empty array for empty input', () => {
    expect(chunkMarkdown('', 40)).toEqual([]);
  });

  it('returns single chunk when input fits', () => {
    expect(chunkMarkdown('hi', 40)).toEqual(['hi']);
  });

  it('splits on chunk size boundary', () => {
    expect(chunkMarkdown('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('joining all chunks yields original input', () => {
    const md = '# Heading\n\nSome **bold** text and a `code` span.\n\nA second paragraph.';
    expect(chunkMarkdown(md, 12).join('')).toBe(md);
  });

  it('throws when size is < 1', () => {
    expect(() => chunkMarkdown('hi', 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest src/review/chunk-markdown.util.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/review/chunk-markdown.util.ts
export function chunkMarkdown(text: string, size: number): string[] {
  if (size < 1) throw new Error('chunkMarkdown size must be >= 1');
  if (text.length === 0) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}
```

- [ ] **Step 4: Run test to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest src/review/chunk-markdown.util.spec.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/review/chunk-markdown.util.ts src/review/chunk-markdown.util.spec.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(review): add chunkMarkdown utility for SSE streaming

Splits a string into fixed-size chunks. Used by the upcoming SSE
endpoint to emit AI review markdown progressively.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Add `waitForReview` to `ReviewService`

**Files:**
- Modify: `c:/tmp/bootcamp-platform-lesson/src/review/review.service.ts`
- Test: `c:/tmp/bootcamp-platform-lesson/test/review/review.service.spec.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// test/review/review.service.spec.ts (or extend existing)
import { Test } from '@nestjs/testing';
import { ReviewService } from '../../src/review/review.service';
import { ReviewRepository } from '../../src/review/review.repository';
import { REVIEW_PROVIDER } from '../../src/review/review-provider.interface';

describe('ReviewService.waitForReview', () => {
  let service: ReviewService;
  let repo: { findByAttemptId: jest.Mock };

  beforeEach(async () => {
    repo = { findByAttemptId: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: ReviewRepository, useValue: repo },
        { provide: REVIEW_PROVIDER, useValue: { review: jest.fn() } },
      ],
    }).compile();
    service = module.get(ReviewService);
  });

  it('returns review immediately if already present', async () => {
    repo.findByAttemptId.mockResolvedValue({ markdown: 'done', createdAt: new Date() });
    const r = await service.waitForReview('a-1', { timeoutMs: 100, pollIntervalMs: 10 });
    expect(r?.markdown).toBe('done');
    expect(repo.findByAttemptId).toHaveBeenCalledTimes(1);
  });

  it('polls until review appears', async () => {
    repo.findByAttemptId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ markdown: 'ready', createdAt: new Date() });
    const r = await service.waitForReview('a-2', { timeoutMs: 1000, pollIntervalMs: 10 });
    expect(r?.markdown).toBe('ready');
    expect(repo.findByAttemptId).toHaveBeenCalledTimes(3);
  });

  it('returns null on timeout', async () => {
    repo.findByAttemptId.mockResolvedValue(null);
    const r = await service.waitForReview('a-3', { timeoutMs: 50, pollIntervalMs: 10 });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest test/review/review.service.spec.ts
```

Expected: FAIL — `waitForReview` does not exist.

- [ ] **Step 3: Implement**

In `src/review/review.service.ts`, add:

```ts
async waitForReview(
  attemptId: string,
  opts: { timeoutMs: number; pollIntervalMs?: number } = { timeoutMs: 30_000 },
): Promise<{ markdown: string; createdAt: Date } | null> {
  const interval = opts.pollIntervalMs ?? 250;
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() <= deadline) {
    const review = await this.repository.findByAttemptId(attemptId);
    if (review) return { markdown: review.markdown, createdAt: review.createdAt };
    if (Date.now() + interval > deadline) break;
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest test/review/review.service.spec.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/review/review.service.ts test/review/review.service.spec.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(review): add waitForReview helper that polls until review lands

Used by the upcoming SSE endpoint to block until the existing review
pipeline writes to CodeReview. Times out cleanly so a slow / failed
review surfaces as 'no result' rather than hanging forever.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: Add SSE streaming endpoint to `ReviewController`

**Files:**
- Modify: `c:/tmp/bootcamp-platform-lesson/src/review/review.controller.ts`
- Test: `c:/tmp/bootcamp-platform-lesson/test/review/review.controller.e2e-spec.ts` (create or extend)

- [ ] **Step 1: Write the failing integration test**

```ts
// test/review/review.controller.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
// authCookie / seed helpers — adapt to existing fixture pattern

describe('GET /api/reviews/:attemptId/stream', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => { await app.close(); });

  it('streams chunk events terminated by a done event when review exists', async () => {
    const { attemptId, studentId } = await seedAttemptAndReview('# Looks good\n\nNice work.', prisma);
    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', authCookie(studentId))
      .buffer(true)
      .parse((res, cb) => {
        let body = '';
        res.on('data', (c) => { body += c.toString(); });
        res.on('end', () => cb(null, body));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const body = res.body as string;
    const chunkEvents = (body.match(/event: chunk/g) ?? []).length;
    expect(chunkEvents).toBeGreaterThan(0);
    expect(body).toContain('event: done');
    // Reassemble and confirm
    const chunks = [...body.matchAll(/event: chunk\ndata: (.*)\n/g)].map((m) => JSON.parse(m[1]));
    expect(chunks.join('')).toBe('# Looks good\n\nNice work.');
  });

  it('emits an error event with timeout when no review materializes', async () => {
    const { attemptId, studentId } = await seedAttemptOnly(prisma);  // no review row written
    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', authCookie(studentId))
      .query({ timeoutMs: 50 })
      .buffer(true)
      .parse((res, cb) => {
        let body = '';
        res.on('data', (c) => { body += c.toString(); });
        res.on('end', () => cb(null, body));
      });
    expect((res.body as string)).toContain('event: error');
  });

  it('returns 403 when student does not own the review', async () => {
    const { attemptId } = await seedAttemptAndReview('x', prisma);
    const otherStudent = await seedStudent(prisma);
    const res = await request(app.getHttpServer())
      .get(`/api/reviews/${attemptId}/stream`)
      .set('Cookie', authCookie(otherStudent));
    expect(res.status).toBe(403);
  });
});
```

Adapt seed helpers / cookie helper to the existing review test patterns.

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest test/review/review.controller.e2e-spec.ts
```

Expected: FAIL — endpoint does not exist (404).

- [ ] **Step 3: Implement the endpoint**

In `src/review/review.controller.ts`:

```ts
import { Controller, Get, Param, UseGuards, NotFoundException, ForbiddenException, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { chunkMarkdown } from './chunk-markdown.util';

// keep existing constructor + getReview route

@Get(':attemptId/stream')
@UseGuards(JwtAuthGuard)
async streamReview(
  @Param('attemptId') attemptId: string,
  @CurrentUser() user: { userId: string },
  @Res() res: Response,
  @Query('timeoutMs') timeoutMsParam?: string,
): Promise<void> {
  // Authorize ownership early — same check as getReview, but defer 404s to the wait loop.
  const student = await this.studentRepository.findByUserId(user.userId);
  if (!student) throw new ForbiddenException('You do not have access to this review');

  const existing = await this.reviewRepository.findByAttemptId(attemptId);
  if (existing && existing.studentId !== student.id) {
    throw new ForbiddenException('You do not have access to this review');
  }
  // If existing is null we do not yet know the studentId. We rely on the upstream
  // attempt's studentId via the review pipeline; checking ownership again post-wait.

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const timeoutMs = timeoutMsParam ? Number(timeoutMsParam) : 30_000;
  const review = await this.reviewService.waitForReview(attemptId, { timeoutMs });
  if (!review) {
    res.write(`event: error\ndata: timeout\n\n`);
    res.end();
    return;
  }

  // Re-check ownership now that the review row exists.
  const fresh = await this.reviewRepository.findByAttemptId(attemptId);
  if (fresh && fresh.studentId !== student.id) {
    res.write(`event: error\ndata: forbidden\n\n`);
    res.end();
    return;
  }

  for (const chunk of chunkMarkdown(review.markdown, 40)) {
    res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
    await new Promise((r) => setTimeout(r, 30));
  }
  res.write(`event: done\ndata: \n\n`);
  res.end();
}
```

Wire `ReviewService` into the controller's constructor:

```ts
constructor(
  private readonly reviewRepository: ReviewRepository,
  private readonly studentRepository: StudentRepository,
  private readonly reviewService: ReviewService,
) {}
```

Verify `review.module.ts` already provides `ReviewService` (it does — used by `SubmissionService`).

- [ ] **Step 4: Run tests to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx jest test/review/review.controller.e2e-spec.ts
```

Expected: PASS — 3 tests. The 403 test for cross-student access uses the early-existing-review check, which the test seeds with a real review.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-lesson add src/review/review.controller.ts test/review/review.controller.e2e-spec.ts
git -C c:/tmp/bootcamp-platform-lesson commit -m "$(cat <<'EOF'
feat(review): add SSE streaming endpoint for AI review markdown

GET /api/reviews/:attemptId/stream waits for the review to land,
then chunks the markdown across SSE events at 30ms cadence. Times
out as 'event: error data: timeout' so the web client falls back
to polling. Provider interface is untouched (server-side fake
streaming over the existing pipeline).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 9: Run the full platform test sweep

**Files:** none

- [ ] **Step 1: Run all unit + integration tests**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npm run test
```

Expected: green across the board.

- [ ] **Step 2: Run tsc clean check**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run lint**

```powershell
cd c:/tmp/bootcamp-platform-lesson; npm run lint
```

Expected: zero errors. Fix any new violations introduced by Tasks 2–8 inline; re-commit as `chore(platform): lint fixes` if needed.

### Task 10: Merge platform branch to platform master locally

**Files:** none (git operation only)

- [ ] **Step 1: Verify there are no uncommitted changes**

```powershell
git -C c:/tmp/bootcamp-platform-lesson status
```

Expected: working tree clean.

- [ ] **Step 2: Merge into the platform main checkout's master, fast-forward only**

```powershell
git -C c:/Users/ricma/BootCamp/platform fetch c:/tmp/bootcamp-platform-lesson feat/lesson-payload:feat/lesson-payload
git -C c:/Users/ricma/BootCamp/platform checkout master
git -C c:/Users/ricma/BootCamp/platform merge --ff-only feat/lesson-payload
```

Expected: merge succeeds. If `git checkout master` fails because the platform main checkout has uncommitted changes on `feat/adaptive-next-lesson`, stash or commit them first — do not lose work.

- [ ] **Step 3: Capture the new platform master SHA**

```powershell
git -C c:/Users/ricma/BootCamp/platform rev-parse master
```

Record this SHA for the next-session prompt update at the end of the project.

- [ ] **Step 4: Remove the worktree**

```powershell
git -C c:/Users/ricma/BootCamp/platform worktree remove c:/tmp/bootcamp-platform-lesson
```

Expected: worktree gone.

---

## Phase 2 — Web changes (`feat/lesson`)

All Phase 2 work happens in `c:/tmp/bootcamp-web-lesson`.

### Task 11: Create web worktree on `feat/lesson`

**Files:** none (git operation only)

- [ ] **Step 1: Create worktree**

```powershell
git -C c:/Users/ricma/BootCamp/web worktree add -b feat/lesson c:/tmp/bootcamp-web-lesson origin/master
```

Expected: new worktree at `c:/tmp/bootcamp-web-lesson` on branch `feat/lesson`, based on web master `33b8d40`.

- [ ] **Step 2: Install dependencies**

```powershell
cd c:/tmp/bootcamp-web-lesson; npm install
```

Expected: install completes.

- [ ] **Step 3: Verify baseline tsc state**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit
```

Expected: 21 errors, all in `tests/renderers/*.test.tsx`. Record this baseline so later tasks know which errors are pre-existing.

- [ ] **Step 4: Verify baseline test pass**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run
```

Expected: existing 305 tests green (per next-session prompt).

### Task 12: Mirror `ExerciseAttemptStatus` into web types

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/lib/exercise-payloads.ts`
- Modify: `c:/tmp/bootcamp-web-lesson/lib/exercise-payloads.zod.ts`
- Modify: `c:/tmp/bootcamp-web-lesson/lib/submit.ts`

- [ ] **Step 1: Add type and update `ExerciseDTO`**

In `lib/exercise-payloads.ts`, add at the bottom of the type declarations and extend `ExerciseDTO`:

```ts
export type ExerciseAttemptStatus = 'unattempted' | 'first_try' | 'eventual';

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
  attemptStatus: ExerciseAttemptStatus;
};
```

- [ ] **Step 2: Mirror in zod schema**

In `lib/exercise-payloads.zod.ts`, find the exerciseDTO schema and append the field:

```ts
attemptStatus: z.enum(['unattempted', 'first_try', 'eventual']),
```

- [ ] **Step 3: Add `newAttemptStatus` to `SubmitResponse`**

In `lib/submit.ts`:

```ts
import type { ExerciseAttemptStatus } from './exercise-payloads';

export type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;
  totalPointsExercise: number;
  totalPoints: number;
  outcome?: string;
  stdout?: string;
  stderr?: string;
  newBadges?: Array<{ id: string; name: string; icon: string }>;
  attemptId: string;
  newAttemptStatus: ExerciseAttemptStatus;
};
```

In the catch-block fallback, set `newAttemptStatus: 'unattempted'`:

```ts
return {
  passed: false, pointsAwarded: 0, totalPointsExercise: 0, totalPoints: 0,
  outcome: 'internal_error',
  stderr: `could not reach submission service: ${(err as Error).message}`,
  newBadges: [],
  attemptId: '',
  newAttemptStatus: 'unattempted',
};
```

- [ ] **Step 4: Run tsc — expect new failures pointing at unfixed test files**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit
```

Expected: still 21 errors plus any new `attemptStatus`-related errors in test fixtures (likely in `tests/__fixtures__/` or per-test mocks). Fix the fixture errors NOW (the renderer test files will be fixed per renderer in Tasks 23–28). Test fixtures that construct `ExerciseDTO` literals must include `attemptStatus: 'unattempted'`.

- [ ] **Step 5: Find and fix exercise DTO fixtures**

```powershell
grep -rn "type: 'multiple_choice'\|type: 'fill_blank'\|type: 'predict_output'\|type: 'code'\|type: 'fix_bug'\|type: 'capstone_submission'" c:/tmp/bootcamp-web-lesson/tests/__fixtures__ c:/tmp/bootcamp-web-lesson/tests/lesson c:/tmp/bootcamp-web-lesson/tests/lib c:/tmp/bootcamp-web-lesson/tests/pages 2>&1 | head -40
```

For each fixture that constructs a full `ExerciseDTO`, add `attemptStatus: 'unattempted'` (or whichever status fits the test scenario). Skip files under `tests/renderers/` — those are fixed per-task in Tasks 23–28.

- [ ] **Step 6: Re-run tsc**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit 2>&1 | grep -v "^tests/renderers/" | grep -c "error TS"
```

Expected: 0 (zero errors outside of `tests/renderers/`).

- [ ] **Step 7: Run vitest to confirm no test regressions**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run
```

Expected: 305+ green (no regression from the field addition).

- [ ] **Step 8: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add lib/exercise-payloads.ts lib/exercise-payloads.zod.ts lib/submit.ts tests/__fixtures__ tests/lesson tests/lib tests/pages
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lib): mirror ExerciseAttemptStatus from platform DTO

Adds the attemptStatus field on ExerciseDTO and newAttemptStatus on
SubmitResponse. Updates fixtures outside of tests/renderers (those
are fixed per renderer in later tasks).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 13: Port `.player` CSS slice into the web styles

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/styles/app.css` (or wherever the design tokens already live in web)

- [ ] **Step 1: Locate the existing styles file structure**

```powershell
ls c:/tmp/bootcamp-web-lesson/styles
```

Expected: `tokens.css`, `components.css`, `app.css` (or similar). Confirm `.player` is not already defined.

```powershell
grep -n "\.player" c:/tmp/bootcamp-web-lesson/styles/*.css
```

If found, skip to Step 3.

- [ ] **Step 2: Append the player slice to `styles/app.css`**

```css
/* Lesson player — see docs/superpowers/design/app.css lines 151–179 */
.player {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  background: var(--bg-0);
}
.player-head {
  display: flex; align-items: center; gap: 20px;
  padding: 14px 28px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-1);
}
.player-progress {
  flex: 1; max-width: 480px;
  margin: 0 auto;
}
.player-body { padding: 56px 32px; }
.player-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 28px;
  border-top: 1px solid var(--line-1);
  background: var(--bg-1);
}

/* Hex bar — earn-on-perfection per-exercise badge bar */
.hexbar { display: inline-flex; gap: 4px; align-items: center; }
.hex {
  width: 16px; height: 16px;
  display: inline-block;
  clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
  background: var(--line-2);
}
.hex.first_try { background: var(--peacock-400); }
.hex.eventual {
  background: linear-gradient(90deg, var(--peacock-400) 50%, var(--line-2) 50%);
}
```

- [ ] **Step 3: Confirm globals.css imports `styles/app.css`**

```powershell
grep -n "app.css" c:/tmp/bootcamp-web-lesson/app/globals.css
```

Expected: `@import '../styles/app.css';` or similar. If absent, add it.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add styles/app.css app/globals.css
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(styles): port .player and .hex CSS slice from design bundle

Adds the player chrome grid (.player / .player-head / .player-body /
.player-foot) and the hex bar styles. Source: docs/superpowers/design/
app.css lines 151–179, hex extended for E's earn-on-perfection model.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: Split `(authed)` into `(shell)` and `(immersive)` route groups

**Files:**
- Refactor: `c:/tmp/bootcamp-web-lesson/app/(authed)/layout.tsx` — auth check only
- Create: `c:/tmp/bootcamp-web-lesson/app/(authed)/(shell)/layout.tsx` — Sidebar + Topbar
- Create: `c:/tmp/bootcamp-web-lesson/app/(authed)/(immersive)/layout.tsx` — pass-through
- Move: every directory under `app/(authed)/` (except `lesson`) into `app/(authed)/(shell)/`
- Move: `app/(authed)/lesson/[id]/` → `app/(authed)/(immersive)/lesson/[id]/`

- [ ] **Step 1: Create the (shell) layout**

```ts
// app/(authed)/(shell)/layout.tsx
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <div>
        <Topbar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the (immersive) layout**

```ts
// app/(authed)/(immersive)/layout.tsx
import type { ReactNode } from 'react';
export default function ImmersiveLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Reduce the (authed) layout to auth-only**

```ts
// app/(authed)/layout.tsx
'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { TrackProvider } from '@/lib/track-context';

export default function AuthedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return <TrackProvider>{children}</TrackProvider>;
}
```

- [ ] **Step 4: Move all existing `(authed)/<route>/...` directories into `(authed)/(shell)/<route>/...`**

```powershell
# In PowerShell:
$src = "c:/tmp/bootcamp-web-lesson/app/(authed)"
$dst = "$src/(shell)"
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Get-ChildItem -Path $src -Directory | Where-Object {
  $_.Name -ne '(shell)' -and $_.Name -ne '(immersive)' -and $_.Name -ne 'lesson'
} | ForEach-Object {
  git -C c:/tmp/bootcamp-web-lesson mv "app/(authed)/$($_.Name)" "app/(authed)/(shell)/$($_.Name)"
}
```

Expected: `dashboard`, `tracks`, `instructor`, `review`, `badges` (whatever exists) all move to `(shell)/`. URL paths unchanged because route groups are URL-invisible.

- [ ] **Step 5: Move lesson into (immersive)**

```powershell
git -C c:/tmp/bootcamp-web-lesson mv "app/(authed)/lesson" "app/(authed)/(immersive)/lesson"
```

- [ ] **Step 6: Run dev server and smoke-test**

```powershell
cd c:/tmp/bootcamp-web-lesson; npm run dev
```

Open http://localhost:3001/dashboard (or wherever the dev port lands). Confirm Sidebar+Topbar render. Open http://localhost:3001/lesson/<seeded-lesson-id> (use any existing lesson id from a seeded DB, or note that this URL will 500 right now because `LessonPlayerShell` does not yet exist — that is expected; we are only verifying the route group layout works for the shelled pages).

Stop the dev server.

- [ ] **Step 7: Run tsc and tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit 2>&1 | grep -v "^tests/renderers/" | grep -c "error TS"
cd c:/tmp/bootcamp-web-lesson; npx vitest run
```

Expected: 0 non-renderer tsc errors, 305+ tests green.

- [ ] **Step 8: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add app/
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(app): split (authed) into (shell) and (immersive) route groups

(authed)/layout.tsx now does auth + TrackProvider only; (shell)/
layout.tsx renders Sidebar+Topbar for the dashboard / tracks / etc.
(immersive)/layout.tsx is a bare pass-through for the lesson route
that will be full-bleed. URL paths unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 15: Build `HexBar` component with tests

**Files:**
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/player/HexBar.tsx`
- Test: `c:/tmp/bootcamp-web-lesson/tests/lesson/HexBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lesson/HexBar.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HexBar } from '@/components/lesson/player/HexBar';

describe('HexBar', () => {
  it('renders one hex per state', () => {
    const { container } = render(<HexBar states={['first_try', 'eventual', 'unattempted']} />);
    expect(container.querySelectorAll('.hex')).toHaveLength(3);
  });

  it('applies the state class to each hex', () => {
    const { container } = render(<HexBar states={['first_try', 'eventual', 'unattempted']} />);
    const hexes = container.querySelectorAll('.hex');
    expect(hexes[0]).toHaveClass('first_try');
    expect(hexes[1]).toHaveClass('eventual');
    expect(hexes[2]).not.toHaveClass('first_try');
    expect(hexes[2]).not.toHaveClass('eventual');
  });

  it('renders nothing when states is empty', () => {
    const { container } = render(<HexBar states={[]} />);
    expect(container.querySelectorAll('.hex')).toHaveLength(0);
  });

  it('exposes a label for screen readers', () => {
    const { container } = render(<HexBar states={['first_try', 'unattempted']} />);
    const wrapper = container.querySelector('.hexbar');
    expect(wrapper?.getAttribute('aria-label')).toMatch(/1 of 2/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/HexBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/lesson/player/HexBar.tsx
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

export function HexBar({ states }: { states: ReadonlyArray<ExerciseAttemptStatus> }) {
  const earned = states.filter((s) => s === 'first_try').length;
  return (
    <div className="hexbar" aria-label={`Hex score: ${earned} of ${states.length}`}>
      {states.map((s, i) => (
        <span key={i} className={`hex ${s}`} aria-hidden="true" />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/HexBar.test.tsx
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/player/HexBar.tsx tests/lesson/HexBar.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): add HexBar component for per-lesson earn-on-perfection score

One hex per exercise step. Filled (first_try), half (eventual), or
outline (unattempted). Aria-label exposes the earned/total count.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Build `PlayerHead`, `PlayerFoot`, `PlayerBody` shell pieces

**Files:**
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/player/PlayerHead.tsx`
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/player/PlayerFoot.tsx`
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/player/PlayerBody.tsx`
- Test: `c:/tmp/bootcamp-web-lesson/tests/lesson/PlayerChrome.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lesson/PlayerChrome.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerHead } from '@/components/lesson/player/PlayerHead';
import { PlayerFoot } from '@/components/lesson/player/PlayerFoot';
import { PlayerBody } from '@/components/lesson/player/PlayerBody';

describe('PlayerHead', () => {
  it('renders progress text and back-to-track button', async () => {
    const onBack = vi.fn();
    render(
      <PlayerHead
        title="Lesson 08 · Concept check"
        stepCurrent={2}
        stepTotal={5}
        hexStates={['first_try', 'eventual', 'unattempted']}
        onBackToTrack={onBack}
      />,
    );
    expect(screen.getByText(/Lesson 08/)).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByLabelText(/Hex score/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back to track/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('hides the hex bar when hexStates is undefined', () => {
    render(<PlayerHead title="x" stepCurrent={1} stepTotal={1} onBackToTrack={() => {}} />);
    expect(screen.queryByLabelText(/Hex score/i)).not.toBeInTheDocument();
  });
});

describe('PlayerFoot', () => {
  it('disables Previous on the first step', async () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<PlayerFoot stepCurrent={0} stepTotal={5} onPrev={onPrev} onNext={onNext} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('shows "Finish lesson" copy on the last step', () => {
    render(<PlayerFoot stepCurrent={4} stepTotal={5} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByRole('button', { name: /finish lesson/i })).toBeInTheDocument();
  });
});

describe('PlayerBody', () => {
  it('renders children inside the body wrapper', () => {
    const { container } = render(<PlayerBody><span>hi</span></PlayerBody>);
    expect(container.querySelector('.player-body')).toBeInTheDocument();
    expect(container.textContent).toContain('hi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/PlayerChrome.test.tsx
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `PlayerHead`**

```tsx
// components/lesson/player/PlayerHead.tsx
import { HexBar } from './HexBar';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

export function PlayerHead({
  title, stepCurrent, stepTotal, hexStates, onBackToTrack,
}: {
  title: string;
  stepCurrent: number;
  stepTotal: number;
  hexStates?: ReadonlyArray<ExerciseAttemptStatus>;
  onBackToTrack: () => void;
}) {
  return (
    <div className="player-head">
      <button className="btn btn-ghost btn-sm" onClick={onBackToTrack}>
        ← Back to track
      </button>
      <div className="player-progress">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="eyebrow">{title}</span>
          <span className="mono muted">{stepCurrent}/{stepTotal}</span>
        </div>
        <div className="bar"><div className="bar-fill" style={{ width: `${(stepCurrent / stepTotal) * 100}%` }} /></div>
      </div>
      {hexStates ? <HexBar states={hexStates} /> : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement `PlayerFoot`**

```tsx
// components/lesson/player/PlayerFoot.tsx
export function PlayerFoot({
  stepCurrent, stepTotal, onPrev, onNext,
}: {
  stepCurrent: number;
  stepTotal: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isLast = stepCurrent === stepTotal - 1;
  return (
    <div className="player-foot">
      <button
        className="btn btn-ghost"
        onClick={onPrev}
        disabled={stepCurrent === 0}
      >
        ← Previous
      </button>
      <div className="row" style={{ gap: 8 }}>
        {Array.from({ length: stepTotal }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === stepCurrent ? 'var(--peacock-400)' : i < stepCurrent ? 'var(--success-400)' : 'var(--line-2)',
            }}
          />
        ))}
      </div>
      <button className="btn btn-iridescent" onClick={onNext}>
        {isLast ? 'Finish lesson' : 'Continue'} →
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `PlayerBody`**

```tsx
// components/lesson/player/PlayerBody.tsx
import type { ReactNode } from 'react';
export function PlayerBody({ children }: { children: ReactNode }) {
  return <div className="player-body">{children}</div>;
}
```

- [ ] **Step 6: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/PlayerChrome.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/player/PlayerHead.tsx components/lesson/player/PlayerFoot.tsx components/lesson/player/PlayerBody.tsx tests/lesson/PlayerChrome.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): add PlayerHead / PlayerFoot / PlayerBody chrome pieces

Stateless presentational components owning the head/body/foot grid
slots of the new lesson player. PlayerHead hosts the back button,
progress bar, and optional HexBar. PlayerFoot owns prev/continue
with last-step copy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: Build `LessonCompleteScreen`

**Files:**
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/player/LessonCompleteScreen.tsx`
- Test: `c:/tmp/bootcamp-web-lesson/tests/lesson/LessonCompleteScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lesson/LessonCompleteScreen.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonCompleteScreen } from '@/components/lesson/player/LessonCompleteScreen';

describe('LessonCompleteScreen', () => {
  it('renders regular variant with hex summary and next-lesson link when present', async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(
      <LessonCompleteScreen
        variant="regular"
        hexStates={['first_try', 'eventual', 'first_try']}
        nextLessonId="l-2"
        onNextLesson={onNext}
        onBackToTrack={onBack}
      />,
    );
    expect(screen.getByText(/Lesson complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next lesson/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('renders pool_complete variant with FreshExercises action', async () => {
    const onFresh = vi.fn();
    render(
      <LessonCompleteScreen
        variant="pool_complete"
        hexStates={['first_try']}
        onFreshExercises={onFresh}
        onBackToTrack={() => {}}
      />,
    );
    expect(screen.getByText(/Pool complete/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /fresh exercises/i }));
    expect(onFresh).toHaveBeenCalled();
  });

  it('omits next-lesson button when nextLessonId is absent', () => {
    render(<LessonCompleteScreen variant="regular" hexStates={[]} onBackToTrack={() => {}} />);
    expect(screen.queryByRole('button', { name: /next lesson/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to track/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/LessonCompleteScreen.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/lesson/player/LessonCompleteScreen.tsx
import { HexBar } from './HexBar';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

type Props = {
  variant: 'regular' | 'pool_complete';
  hexStates: ReadonlyArray<ExerciseAttemptStatus>;
  nextLessonId?: string | null;
  onNextLesson?: () => void;
  onFreshExercises?: () => void;
  onBackToTrack: () => void;
};

export function LessonCompleteScreen(props: Props) {
  const earned = props.hexStates.filter((s) => s === 'first_try').length;
  const heading = props.variant === 'pool_complete' ? 'Pool complete' : 'Lesson complete';
  const subtitle = props.variant === 'pool_complete'
    ? 'You have seen every exercise in this lesson’s current pool.'
    : 'Nice work.';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
      <h2 className="h-display" style={{ fontSize: 'var(--t-4xl)', marginBottom: 12 }}>{heading}</h2>
      <p className="muted" style={{ fontSize: 'var(--t-lg)', marginBottom: 28 }}>{subtitle}</p>
      {props.hexStates.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>You earned {earned} of {props.hexStates.length}</div>
          <HexBar states={props.hexStates} />
        </div>
      )}
      <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
        {props.variant === 'pool_complete' && props.onFreshExercises && (
          <button className="btn btn-primary" onClick={props.onFreshExercises}>Fresh exercises</button>
        )}
        {props.variant === 'regular' && props.nextLessonId && props.onNextLesson && (
          <button className="btn btn-iridescent" onClick={props.onNextLesson}>Next lesson →</button>
        )}
        <button className="btn btn-ghost" onClick={props.onBackToTrack}>Back to track</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/LessonCompleteScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/player/LessonCompleteScreen.tsx tests/lesson/LessonCompleteScreen.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): add LessonCompleteScreen for the synthetic last step

Renders the hex summary plus a next-lesson / back-to-track button
pair. The pool_complete variant absorbs FreshExercises action.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: Build `LessonPlayerShell`

**Files:**
- Create: `c:/tmp/bootcamp-web-lesson/components/lesson/LessonPlayerShell.tsx`
- Test: `c:/tmp/bootcamp-web-lesson/tests/lesson/LessonPlayerShell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lesson/LessonPlayerShell.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonPlayerShell } from '@/components/lesson/LessonPlayerShell';
import type { LessonResponse } from '@/lib/api';

const replace = vi.fn();
const useSearchParams = vi.fn(() => new URLSearchParams(''));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => useSearchParams(),
}));

const sampleLesson: LessonResponse = {
  id: 'l-1', version: 1, title: 'Lesson 1', trackId: 't-1', assignment: null,
  blocks: [
    { kind: 'explanation', id: 'b-0', markdown: '# Intro' },
    { kind: 'exercise', id: 'b-1', exercise: {
      id: 'e-1', version: 1, type: 'multiple_choice',
      promptMarkdown: 'pick one', pointsMax: 100,
      payload: { type: 'multiple_choice', questionMarkdown: 'q', options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      attemptStatus: 'unattempted',
    } },
    { kind: 'exercise', id: 'b-2', exercise: {
      id: 'e-2', version: 1, type: 'multiple_choice',
      promptMarkdown: 'pick one', pointsMax: 100,
      payload: { type: 'multiple_choice', questionMarkdown: 'q', options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      attemptStatus: 'first_try',
    } },
  ],
};

describe('LessonPlayerShell', () => {
  beforeEach(() => { replace.mockReset(); useSearchParams.mockReturnValue(new URLSearchParams('')); });

  it('renders step 0 (explanation) by default', () => {
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/Intro/i)).toBeInTheDocument();
  });

  it('reads ?step from the URL', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=1'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/pick one/i)).toBeInTheDocument();
  });

  it('renders the lesson-complete screen when step === blocks.length', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=3'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/Lesson complete/i)).toBeInTheDocument();
  });

  it('routes to next step on Continue', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=0'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('step=1'), expect.objectContaining({ scroll: false }));
  });

  it('shows hex bar with attemptStatus from each exercise', () => {
    render(<LessonPlayerShell lesson={sampleLesson} />);
    const hexes = document.querySelectorAll('.hex');
    expect(hexes).toHaveLength(2);  // two exercises
    expect(hexes[0]).not.toHaveClass('first_try');  // unattempted
    expect(hexes[1]).toHaveClass('first_try');
  });

  it('hides hex bar for single-exercise capstone lessons', () => {
    const capstoneLesson: LessonResponse = {
      ...sampleLesson,
      blocks: [{ kind: 'exercise', id: 'b-0', exercise: {
        id: 'cap', version: 1, type: 'capstone_submission',
        promptMarkdown: 'submit', pointsMax: 0,
        payload: { type: 'capstone_submission' },
        attemptStatus: 'unattempted',
      } }],
    };
    render(<LessonPlayerShell lesson={capstoneLesson} />);
    expect(document.querySelector('.hex')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/LessonPlayerShell.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// components/lesson/LessonPlayerShell.tsx
'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LessonResponse } from '@/lib/api';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { PlayerHead } from './player/PlayerHead';
import { PlayerFoot } from './player/PlayerFoot';
import { PlayerBody } from './player/PlayerBody';
import { LessonCompleteScreen } from './player/LessonCompleteScreen';
import { ExerciseBlock } from './ExerciseBlock';
import { ExplanationBlock } from './ExplanationBlock';

export function LessonPlayerShell({ lesson }: { lesson: LessonResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const step = clampStep(Number(params.get('step') ?? 0), lesson.blocks.length);

  // Hex map: hydrate from payload, overlay session updates
  const initialMap = useMemo(() => {
    const m = new Map<string, ExerciseAttemptStatus>();
    for (const b of lesson.blocks) if (b.kind === 'exercise') m.set(b.exercise.id, b.exercise.attemptStatus);
    return m;
  }, [lesson]);
  const [hexMap, setHexMap] = useState<Map<string, ExerciseAttemptStatus>>(initialMap);

  const isCapstoneOnly = lesson.blocks.length === 1
    && lesson.blocks[0].kind === 'exercise'
    && lesson.blocks[0].exercise.type === 'capstone_submission';

  const exerciseOrdering = lesson.blocks.filter((b) => b.kind === 'exercise');
  const hexStates: ExerciseAttemptStatus[] = exerciseOrdering.map(
    (b) => (b.kind === 'exercise' ? hexMap.get(b.exercise.id) ?? 'unattempted' : 'unattempted'),
  );

  const totalSteps = lesson.blocks.length + 1;  // synthetic complete step
  const isComplete = step === lesson.blocks.length;

  const goToStep = (next: number) => {
    const url = `?step=${clampStep(next, lesson.blocks.length)}`;
    router.replace(url, { scroll: false });
  };

  const onAttempt = (exerciseId: string, status: ExerciseAttemptStatus) => {
    setHexMap((m) => {
      const next = new Map(m);
      // Once first_try is earned, do not downgrade (defensive — server enforces same).
      const prior = next.get(exerciseId);
      if (prior === 'first_try') return next;
      next.set(exerciseId, status);
      return next;
    });
  };

  const onBackToTrack = () => {
    if (lesson.trackId) router.push(`/tracks/${lesson.trackId}`);
    else router.push('/dashboard');
  };

  return (
    <div className="player">
      <PlayerHead
        title={isComplete ? `${lesson.title} · Complete` : lesson.title}
        stepCurrent={Math.min(step + 1, lesson.blocks.length)}
        stepTotal={lesson.blocks.length}
        hexStates={isCapstoneOnly ? undefined : hexStates}
        onBackToTrack={onBackToTrack}
      />
      <PlayerBody>
        {isComplete ? (
          <LessonCompleteScreen
            variant={lesson.assignment?.status === 'pool_complete' ? 'pool_complete' : 'regular'}
            hexStates={hexStates}
            nextLessonId={null /* W6 will wire next-lesson lookup */}
            onBackToTrack={onBackToTrack}
          />
        ) : (
          <BlockRenderer block={lesson.blocks[step]} onAttempt={onAttempt} />
        )}
      </PlayerBody>
      {!isComplete ? (
        <PlayerFoot
          stepCurrent={step}
          stepTotal={lesson.blocks.length}
          onPrev={() => goToStep(step - 1)}
          onNext={() => goToStep(step + 1)}
        />
      ) : (
        <PlayerFoot stepCurrent={lesson.blocks.length} stepTotal={lesson.blocks.length} onPrev={() => goToStep(step - 1)} onNext={onBackToTrack} />
      )}
    </div>
  );
}

function BlockRenderer({
  block,
  onAttempt,
}: {
  block: LessonResponse['blocks'][number];
  onAttempt: (exerciseId: string, status: ExerciseAttemptStatus) => void;
}) {
  if (block.kind === 'explanation') return <ExplanationBlock markdown={block.markdown} />;
  return (
    <ExerciseBlock
      exercise={block.exercise}
      onAttempt={(status) => onAttempt(block.exercise.id, status)}
    />
  );
}

function clampStep(n: number, totalBlocks: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > totalBlocks) return totalBlocks;
  return n;
}
```

`ExerciseBlock` does not yet accept `onAttempt`; that's added in Task 19 + per-renderer Tasks 23–28.

- [ ] **Step 4: Update `ExerciseBlock` to forward `onAttempt`**

In `components/lesson/ExerciseBlock.tsx`:

```tsx
'use client';
import type { ExerciseDTO, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { MultipleChoiceExercise } from './renderers/MultipleChoiceExercise';
import { FillBlankExercise } from './renderers/FillBlankExercise';
import { PredictOutputExercise } from './renderers/PredictOutputExercise';
import { CodeExercise } from './renderers/CodeExercise';
import { FixBugExercise } from './renderers/FixBugExercise';
import { CapstoneSubmissionExercise } from './renderers/CapstoneSubmissionExercise';

type Props = { exercise: ExerciseDTO; onAttempt?: (status: ExerciseAttemptStatus) => void };

export function ExerciseBlock({ exercise, onAttempt }: Props) {
  switch (exercise.type) {
    case 'multiple_choice':    return <MultipleChoiceExercise      exercise={exercise} onAttempt={onAttempt} />;
    case 'fill_blank':         return <FillBlankExercise           exercise={exercise} onAttempt={onAttempt} />;
    case 'predict_output':     return <PredictOutputExercise       exercise={exercise} onAttempt={onAttempt} />;
    case 'code':               return <CodeExercise                exercise={exercise} onAttempt={onAttempt} />;
    case 'fix_bug':            return <FixBugExercise              exercise={exercise} onAttempt={onAttempt} />;
    case 'capstone_submission': return <CapstoneSubmissionExercise exercise={exercise} onAttempt={onAttempt} />;
  }
}
```

- [ ] **Step 5: Run shell tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/LessonPlayerShell.test.tsx
```

Expected: PASS — 6 tests. (Per-renderer existing tests will not be broken yet because `onAttempt` is optional.)

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/LessonPlayerShell.tsx components/lesson/ExerciseBlock.tsx tests/lesson/LessonPlayerShell.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): add LessonPlayerShell with URL-driven step state

Client component owning the full-bleed player chrome. URL ?step=N
is the source of truth for active step; prev/continue calls
router.replace. Hex map hydrates from payload attemptStatus and
overlays mid-session updates from the per-renderer onAttempt
callback. Synthetic last step renders LessonCompleteScreen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 19: Update `_shared.tsx` with `onAttempt` prop helper

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/_shared.tsx`

- [ ] **Step 1: Add a typed prop helper for `onAttempt`**

Append to `components/lesson/renderers/_shared.tsx`:

```tsx
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

export type RendererProps<P> = P & {
  onAttempt?: (status: ExerciseAttemptStatus) => void;
};
```

This is just a typing convenience; per-renderer signatures will still spell out their props.

- [ ] **Step 2: Run tsc — confirm clean (outside tests/renderers)**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit 2>&1 | grep -v "^tests/renderers/" | grep -c "error TS"
```

Expected: 0.

- [ ] **Step 3: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/_shared.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(renderers): add RendererProps helper exposing onAttempt callback

Typing convenience for the per-renderer refactors that follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 20: Refactor `MultipleChoiceExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/MultipleChoiceExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/MultipleChoiceExercise.test.tsx`

- [ ] **Step 1: Read current renderer to understand its submit shape**

```powershell
cat c:/tmp/bootcamp-web-lesson/components/lesson/renderers/MultipleChoiceExercise.tsx
```

Note where `submitExercise` is called and where pass-state is observable (typically a `passed: true` branch in the response).

- [ ] **Step 2: Update test file — fix tsc errors and add `onAttempt` assertion**

Replace `tests/renderers/MultipleChoiceExercise.test.tsx` with the file structure below (adapt to existing fixture imports — preserve the test cases that already exist, just fix the type errors and add a new `onAttempt` test):

```tsx
// tests/renderers/MultipleChoiceExercise.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultipleChoiceExercise } from '@/components/lesson/renderers/MultipleChoiceExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

vi.mock('@/lib/submit', () => ({ submitExercise: vi.fn() }));
import { submitExercise } from '@/lib/submit';

const loggedInUser = { id: '1', email: 'a@b.com', name: 'A', role: 'student' as const, googleId: null, createdAt: '' };
const mockSetTotalPoints = vi.fn();

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints })),
}));
import { useAuth } from '@/components/layout/AuthProvider';

const ex: ExerciseDTO = {
  id: 'mc', version: 1, type: 'multiple_choice',
  promptMarkdown: 'p', pointsMax: 100,
  payload: { type: 'multiple_choice', questionMarkdown: 'q', options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }], correctOptionIds: ['a'], multiSelect: false },
  attemptStatus: 'unattempted',
};

describe('MultipleChoiceExercise', () => {
  beforeEach(() => {
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints });
  });

  it('renders the options', () => {
    render(<MultipleChoiceExercise exercise={ex} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('submits and shows correct state on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 50,
      attemptId: 'a-1', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByText('Alpha'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
  });

  it('calls onAttempt with newAttemptStatus on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 50,
      attemptId: 'a-1', newAttemptStatus: 'first_try',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByText('Alpha'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onAttempt).toHaveBeenCalledWith('first_try'));
  });

  it('does not call onAttempt on fail', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 0,
      attemptId: 'a-2', newAttemptStatus: 'unattempted',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByText('Beta'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(onAttempt).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test, verify failures (the new ones, plus the tsc errors are gone)**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/MultipleChoiceExercise.test.tsx
```

Expected: at least the two new `onAttempt` tests fail (signature missing).

- [ ] **Step 4: Refactor renderer to accept `onAttempt` and call it on pass**

In `components/lesson/renderers/MultipleChoiceExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { ExerciseDTO, MultipleChoicePayload, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { submitExercise } from '@/lib/submit';
import { useAuth } from '@/components/layout/AuthProvider';
// keep existing helper / chrome imports as-is

export function MultipleChoiceExercise({
  exercise,
  onAttempt,
}: {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
}) {
  const payload = exercise.payload as MultipleChoicePayload;
  // ... existing state setup

  async function onSubmit() {
    // ... existing submit logic; on a passing response:
    const res = await submitExercise(exercise.id, exercise.version, { answer: selectedIds });
    setSubmitResult(res);
    if (res.passed && onAttempt) onAttempt(res.newAttemptStatus);
  }

  // ... rest of the component, unchanged in JSX shape
}
```

(Adapt to the file's exact structure — only two changes: prop signature and the `onAttempt` call after a passing submit.)

- [ ] **Step 5: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/MultipleChoiceExercise.test.tsx
```

Expected: PASS — all 4 tests.

- [ ] **Step 6: Run tsc and confirm 4 errors gone**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit 2>&1 | grep "tests/renderers/" | grep -c "error TS"
```

Expected: count decreases by ~4 (the MC test file's pre-existing errors are now resolved).

- [ ] **Step 7: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/MultipleChoiceExercise.tsx tests/renderers/MultipleChoiceExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): MultipleChoiceExercise reports onAttempt on pass

Renderer now bubbles newAttemptStatus to the player shell so the
hex bar can update live. Test file fixed to include the new field
on the SubmitResponse mock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 21: Refactor `FillBlankExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/FillBlankExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/FillBlankExercise.test.tsx`

- [ ] **Step 1: Update test — same pattern as MC test (Task 20 Step 2)**

Apply the same shape: add `attemptStatus: 'unattempted'` on the fixture, add `newAttemptStatus` on the SubmitResponse mocks, add an `onAttempt` test pair (called on pass / not called on fail). Preserve existing test cases.

- [ ] **Step 2: Refactor renderer**

In `components/lesson/renderers/FillBlankExercise.tsx`:

```tsx
export function FillBlankExercise({
  exercise,
  onAttempt,
}: {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
}) {
  // ... existing state and submit flow.
  // On a passing response: if (res.passed && onAttempt) onAttempt(res.newAttemptStatus);
}
```

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/FillBlankExercise.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Confirm tsc error count decreased**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit 2>&1 | grep "tests/renderers/" | grep -c "error TS"
```

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/FillBlankExercise.tsx tests/renderers/FillBlankExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): FillBlankExercise reports onAttempt on pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: Refactor `PredictOutputExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/PredictOutputExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/PredictOutputExercise.test.tsx`

- [ ] **Step 1: Update test (same pattern)**

Add `attemptStatus: 'unattempted'` on the fixture, add `newAttemptStatus` on SubmitResponse mocks, add the `onAttempt` test pair.

- [ ] **Step 2: Refactor renderer (same `onAttempt` pattern)**

Add `onAttempt?` prop, call it after a passing submit.

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/PredictOutputExercise.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/PredictOutputExercise.tsx tests/renderers/PredictOutputExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): PredictOutputExercise reports onAttempt on pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: Refactor `CodeExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/CodeExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/CodeExercise.test.tsx`

- [ ] **Step 1: Update test**

CodeExercise has both Run and Submit. `onAttempt` fires only on a passing Submit (Run is dry-run, doesn't change attempt status). Add `newAttemptStatus` on SubmitResponse mocks. Add the `onAttempt` test pair.

- [ ] **Step 2: Refactor renderer — only Submit (not Run) calls onAttempt**

```tsx
export function CodeExercise({
  exercise,
  onAttempt,
}: {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
}) {
  // ... existing logic
  async function onSubmit() {
    // ... existing flow
    const res = await submitExercise(exercise.id, exercise.version, { code });
    setSubmitResult(res);
    setSubmitAttemptId(res.attemptId || null);
    if (res.passed) {
      setTotalPoints(res.totalPoints);
      if (onAttempt) onAttempt(res.newAttemptStatus);
    }
  }
  // onRun unchanged
}
```

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/CodeExercise.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/CodeExercise.tsx tests/renderers/CodeExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): CodeExercise reports onAttempt on passing Submit

Run does not change attempt status. Only Submit's passing branch
fires onAttempt with the server's newAttemptStatus.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 24: Refactor `FixBugExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/FixBugExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/FixBugExercise.test.tsx`

- [ ] **Step 1: Update test (same pattern as CodeExercise — Run + Submit)**

- [ ] **Step 2: Refactor renderer (same `onAttempt` pattern; Submit only)**

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/FixBugExercise.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/FixBugExercise.tsx tests/renderers/FixBugExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): FixBugExercise reports onAttempt on passing Submit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 25: Refactor `CapstoneSubmissionExercise` + fix its test

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/CapstoneSubmissionExercise.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/CapstoneSubmissionExercise.test.tsx`

- [ ] **Step 1: Update test**

Capstone semantics: `passed: false` always (per submission service: `passed = false; outcome = 'pending_review'`). So `onAttempt` should NOT fire — capstone hex stays unattempted (and is hidden anyway in the player). Test asserts `onAttempt` is never called even on submit.

- [ ] **Step 2: Refactor renderer**

```tsx
export function CapstoneSubmissionExercise({
  exercise,
  onAttempt,  // accepted but never invoked — instructor-review only
}: {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
}) {
  // existing capstone submit flow unchanged.
  // Do not call onAttempt — capstone is instructor-graded.
}
```

The unused `onAttempt` prop is intentional — it keeps the prop shape uniform across all renderers.

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/CapstoneSubmissionExercise.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/CapstoneSubmissionExercise.tsx tests/renderers/CapstoneSubmissionExercise.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): CapstoneSubmissionExercise accepts (but does not invoke) onAttempt

Capstone is instructor-graded — there is no auto-pass to bubble.
The prop accepts the callback for shape uniformity but never fires.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 26: Verify all renderer tests pass and the renderer-test tsc errors are zero

**Files:** none

- [ ] **Step 1: Run all renderer tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/
```

Expected: green.

- [ ] **Step 2: Run tsc on the entire tree**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit
```

Expected: zero errors. If any remain, they are likely in fixture files outside of `tests/renderers/` — fix them and re-run before proceeding.

### Task 27: Refactor `AIReview` to EventSource-first with polling fallback

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/renderers/AIReview.tsx`
- Modify: `c:/tmp/bootcamp-web-lesson/tests/renderers/AIReview.test.tsx`

- [ ] **Step 1: Update test — happy path (SSE) + fallback (polling)**

```tsx
// tests/renderers/AIReview.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AIReview } from '@/components/lesson/renderers/AIReview';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  closed = false;
  constructor(url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    (this.listeners[name] ??= []).push(cb);
  }
  emit(name: string, data: string) {
    for (const cb of this.listeners[name] ?? []) cb({ data } as MessageEvent);
  }
  close() { this.closed = true; }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (global as any).EventSource = MockEventSource;
  vi.spyOn(global, 'fetch' as any).mockResolvedValue({
    ok: true, json: async () => ({ markdown: 'fallback markdown' }),
  } as any);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('AIReview', () => {
  it('renders nothing when attemptId is null', () => {
    const { container } = render(<AIReview attemptId={null} />);
    expect(container.textContent).toBe('');
  });

  it('streams chunks via SSE and appends them to the rendered markdown', async () => {
    render(<AIReview attemptId="a-1" />);
    const sse = MockEventSource.instances[0];
    sse.emit('chunk', JSON.stringify('Hello '));
    sse.emit('chunk', JSON.stringify('world'));
    sse.emit('done', '');
    await waitFor(() => expect(screen.getByText(/Hello world/)).toBeInTheDocument());
    expect(sse.closed).toBe(true);
  });

  it('falls back to polling when SSE errors', async () => {
    render(<AIReview attemptId="a-2" />);
    const sse = MockEventSource.instances[0];
    sse.emit('error', '');
    await waitFor(() => expect(screen.getByText(/fallback markdown/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test, verify failures**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/AIReview.test.tsx
```

Expected: existing tests fail because the implementation still uses polling exclusively.

- [ ] **Step 3: Refactor**

```tsx
// components/lesson/renderers/AIReview.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

export function AIReview({ attemptId }: { attemptId: string | null }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!attemptId) { setMarkdown(null); setLoading(false); setTimedOut(false); return; }
    cancelledRef.current = false;
    setLoading(true); setMarkdown(null); setTimedOut(false);

    let sse: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollAbort: AbortController | null = null;

    const cleanup = () => {
      cancelledRef.current = true;
      if (sse) { sse.close(); sse = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (pollAbort) { pollAbort.abort(); pollAbort = null; }
    };

    const startPolling = () => {
      const start = Date.now();
      pollAbort = new AbortController();
      pollTimer = setInterval(async () => {
        if (cancelledRef.current) return;
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          if (pollTimer) clearInterval(pollTimer);
          setLoading(false); setTimedOut(true);
          return;
        }
        try {
          const res = await fetch(`${BASE}/api/reviews/${attemptId}`, { credentials: 'include', signal: pollAbort?.signal });
          if (res.ok) {
            const json = await res.json();
            if (!cancelledRef.current) {
              setMarkdown(json.markdown); setLoading(false);
              if (pollTimer) clearInterval(pollTimer);
            }
          }
        } catch { /* retry */ }
      }, POLL_INTERVAL_MS);
    };

    try {
      sse = new EventSource(`${BASE}/api/reviews/${attemptId}/stream`, { withCredentials: true });
      sse.addEventListener('chunk', (e) => {
        if (cancelledRef.current) return;
        const piece = JSON.parse((e as MessageEvent).data) as string;
        setMarkdown((prev) => (prev ?? '') + piece);
      });
      sse.addEventListener('done', () => {
        if (cancelledRef.current) return;
        setLoading(false); sse?.close(); sse = null;
      });
      sse.addEventListener('error', () => {
        if (cancelledRef.current) return;
        sse?.close(); sse = null;
        setMarkdown(null);  // discard partial — fallback re-renders the full markdown
        startPolling();
      });
    } catch {
      startPolling();
    }

    return cleanup;
  }, [attemptId]);

  if (!attemptId || timedOut) return null;
  if (loading && !markdown) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">🤖 Reviewing your code...</p>
      </div>
    );
  }
  if (!markdown) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/60 dark:bg-blue-950/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">🤖 AI Review</p>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/renderers/AIReview.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/renderers/AIReview.tsx tests/renderers/AIReview.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
refactor(renderers): AIReview uses EventSource with polling fallback

Streams from GET /api/reviews/:attemptId/stream, accumulating chunks
into the rendered markdown. On SSE error, discards the partial
buffer and falls back to the existing polling endpoint. Cleans up
both transports on unmount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 28: Compose lesson page + delete obsolete components

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/app/(authed)/(immersive)/lesson/[id]/page.tsx`
- Delete: `c:/tmp/bootcamp-web-lesson/components/lesson/BlockList.tsx`
- Delete: `c:/tmp/bootcamp-web-lesson/components/lesson/LessonNavigation.tsx`
- Delete: `c:/tmp/bootcamp-web-lesson/components/lesson/FreshExercisesButton.tsx`
- Delete: `c:/tmp/bootcamp-web-lesson/components/lesson/PoolHeaderClient.tsx`
- Delete: `c:/tmp/bootcamp-web-lesson/components/lesson/PoolCompleteView.tsx`

- [ ] **Step 1: Replace `page.tsx` with the thin server component**

```tsx
// app/(authed)/(immersive)/lesson/[id]/page.tsx
import { notFound } from 'next/navigation';
import { fetchLesson } from '@/lib/api';
import { LessonPlayerShell } from '@/components/lesson/LessonPlayerShell';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: { id: string } }) {
  const lesson = await fetchLesson(params.id);
  if (!lesson) notFound();
  return <LessonPlayerShell lesson={lesson} />;
}
```

- [ ] **Step 2: Delete obsolete components**

```powershell
git -C c:/tmp/bootcamp-web-lesson rm components/lesson/BlockList.tsx components/lesson/LessonNavigation.tsx components/lesson/FreshExercisesButton.tsx components/lesson/PoolHeaderClient.tsx components/lesson/PoolCompleteView.tsx
```

- [ ] **Step 3: Find and remove dead imports / references**

```powershell
grep -rn "BlockList\|LessonNavigation\|FreshExercisesButton\|PoolHeaderClient\|PoolCompleteView" c:/tmp/bootcamp-web-lesson/app c:/tmp/bootcamp-web-lesson/components c:/tmp/bootcamp-web-lesson/lib c:/tmp/bootcamp-web-lesson/tests 2>&1
```

For each hit, decide:
- Remove the import and any reference if it was a dead consumer of the deleted component.
- If a test file referenced one of these, delete the test (the components are gone).
- If a fixture imported one, remove the import and any setup using it.

- [ ] **Step 4: Run tsc clean**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Run all tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run
```

Expected: green. The total test count should be near 305 (some deleted alongside `BlockList`/etc) plus the new tests added for HexBar, PlayerChrome, LessonCompleteScreen, LessonPlayerShell.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add app/(authed)/(immersive)/lesson/[id]/page.tsx components/ tests/ lib/
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): compose lesson page with new player; delete obsolete components

The page is now a thin server component fetching the lesson and
rendering LessonPlayerShell. BlockList, LessonNavigation,
FreshExercisesButton, PoolHeaderClient, and PoolCompleteView are
deleted — their behavior is absorbed into LessonPlayerShell and
LessonCompleteScreen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 29: Wire next-lesson lookup into `LessonCompleteScreen`

**Files:**
- Modify: `c:/tmp/bootcamp-web-lesson/components/lesson/LessonPlayerShell.tsx`

The `LessonCompleteScreen` was rendered with `nextLessonId={null}` in Task 18 as a temporary stub. Wire the real lookup now.

- [ ] **Step 1: Add a small async helper to fetch the track and pick next-lesson**

Inline inside `LessonPlayerShell`:

```tsx
import { useEffect, useState } from 'react';
import { fetchTrack } from '@/lib/tracks';
// ...

const [nextLessonId, setNextLessonId] = useState<string | null>(null);

useEffect(() => {
  if (!lesson.trackId) return;
  let cancelled = false;
  fetchTrack(lesson.trackId).then((track) => {
    if (cancelled || !track) return;
    const idx = track.lessons.findIndex((l) => l.id === lesson.id);
    if (idx >= 0 && idx < track.lessons.length - 1) setNextLessonId(track.lessons[idx + 1].id);
  });
  return () => { cancelled = true; };
}, [lesson.trackId, lesson.id]);

// Replace the LessonCompleteScreen render in the existing JSX:
<LessonCompleteScreen
  variant={lesson.assignment?.status === 'pool_complete' ? 'pool_complete' : 'regular'}
  hexStates={hexStates}
  nextLessonId={nextLessonId}
  onNextLesson={nextLessonId ? () => router.push(`/lesson/${nextLessonId}`) : undefined}
  onBackToTrack={onBackToTrack}
/>
```

- [ ] **Step 2: Add a test in `LessonPlayerShell.test.tsx`**

```tsx
vi.mock('@/lib/tracks', () => ({
  fetchTrack: vi.fn(async () => ({
    id: 't-1', title: 'Swift', tint: 'swift',
    lessons: [{ id: 'l-1' }, { id: 'l-2' }],
  })),
}));

it('renders next-lesson link when track has a successor', async () => {
  useSearchParams.mockReturnValue(new URLSearchParams('step=3'));
  render(<LessonPlayerShell lesson={sampleLesson} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /next lesson/i })).toBeInTheDocument());
});
```

- [ ] **Step 3: Run tests**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx vitest run tests/lesson/LessonPlayerShell.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -C c:/tmp/bootcamp-web-lesson add components/lesson/LessonPlayerShell.tsx tests/lesson/LessonPlayerShell.test.tsx
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
feat(lesson): wire next-lesson lookup into LessonCompleteScreen

LessonPlayerShell fetches the track on mount, picks the lesson that
follows the current one (if any), and threads its id into the
celebration screen so students can advance without going back to
the track page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 30: E2E walk + final verification

**Files:**
- Optional: `c:/tmp/bootcamp-web-lesson/tests/e2e/lesson-player.spec.ts` (new Playwright spec if E2E tests run on the project)

- [ ] **Step 1: Confirm Playwright is configured**

```powershell
ls c:/tmp/bootcamp-web-lesson/tests/e2e/ 2>&1
cat c:/tmp/bootcamp-web-lesson/playwright.config.ts 2>&1 | head -20
```

If Playwright is set up, write the spec below; otherwise skip to Step 3 (manual smoke).

- [ ] **Step 2: Write a Playwright spec covering the happy path**

```ts
// tests/e2e/lesson-player.spec.ts
import { test, expect } from '@playwright/test';

test('walks a lesson end-to-end with hex updates', async ({ page }) => {
  // Adapt selectors / login flow to the project's existing auth helper.
  await loginAsSeededStudent(page);

  await page.goto('/lesson/seeded-lesson-id');
  await expect(page.locator('.player-head')).toBeVisible();
  await expect(page.locator('.hexbar')).toBeVisible();

  // Step through the lesson; every Continue advances the URL.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /continue|finish lesson/i }).click();
  }
  await expect(page.getByText(/Lesson complete/i)).toBeVisible();
});
```

- [ ] **Step 3: Manual smoke run**

Start the platform server and the web dev server (separate terminals), log in as a seeded student, and walk through:
1. A regular lesson — confirm hex updates after a passing submission, prev/continue work, lesson-complete screen renders, AI review either streams or falls back.
2. A capstone lesson — confirm hex bar is hidden, "Back to track" button only.
3. A pool-complete lesson — confirm celebration screen variant with FreshExercises action.

Note any UI defects observed and fix inline.

- [ ] **Step 4: Final tsc + vitest sweep**

```powershell
cd c:/tmp/bootcamp-web-lesson; npx tsc --noEmit
cd c:/tmp/bootcamp-web-lesson; npx vitest run
```

Expected: zero tsc errors, all vitest tests green.

- [ ] **Step 5: Commit any inline E2E fixes**

```powershell
git -C c:/tmp/bootcamp-web-lesson add -p   # interactive selection of fixes only
git -C c:/tmp/bootcamp-web-lesson commit -m "$(cat <<'EOF'
fix(lesson): polish from E2E smoke pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no inline fixes were needed, skip the commit.

### Task 31: Merge web branch to web master locally

**Files:** none (git operation only)

- [ ] **Step 1: Verify clean working tree**

```powershell
git -C c:/tmp/bootcamp-web-lesson status
```

Expected: working tree clean.

- [ ] **Step 2: Merge into web master, fast-forward only**

```powershell
git -C c:/Users/ricma/BootCamp/web fetch c:/tmp/bootcamp-web-lesson feat/lesson:feat/lesson
git -C c:/Users/ricma/BootCamp/web checkout master
git -C c:/Users/ricma/BootCamp/web merge --ff-only feat/lesson
```

Expected: merge succeeds. If checkout fails because of in-progress work in the main checkout, stash or commit it first.

- [ ] **Step 3: Capture the new web master SHA**

```powershell
git -C c:/Users/ricma/BootCamp/web rev-parse master
```

Record this SHA — needed for updating the next-session prompt.

- [ ] **Step 4: Remove the worktree**

```powershell
git -C c:/Users/ricma/BootCamp/web worktree remove c:/tmp/bootcamp-web-lesson
```

Expected: worktree gone.

### Task 32: Update next-session prompt for sub-project F

**Files:**
- Modify: `c:/Users/ricma/BootCamp/docs/superpowers/NEXT-SESSION-PROMPT.md`

- [ ] **Step 1: Update the on-ramp content**

Edit the file to:
- Mark Sub-project E (Lesson Player) as merged with the new web master SHA captured in Task 31 Step 3 and the new platform master SHA captured in Task 10 Step 3.
- Move the next-up subject to F (Profile + Leaderboard).
- Carry over patterns E established that F should reuse: renderer ↔ shell `onAttempt` callback pattern, route-group split (`(shell)` vs `(immersive)`), URL-driven step state, server-side fake SSE streaming pattern (in case F needs streaming for the leaderboard live feed).
- Note the canonical view files for F (`app-profile.jsx`, `app-leaderboard.jsx` from the design bundle).
- Keep "Past sub-projects" section appended with E's spec/plan/SHAs.

- [ ] **Step 2: Update the auto-memory MEMORY.md entry**

Edit `c:/Users/ricma/.claude/projects/c--Users-ricma-BootCamp/memory/bootcamp_platform_project.md` (or whichever file the entry lives in per `MEMORY.md`):
- Update the line from "next: E Lesson Player" to "next: F Profile + Leaderboard"
- Append: "sub-project E (Lesson Player) merged YYYY-MM-DD at web `<sha>`, platform `<sha>` (two-repo)"

- [ ] **Step 3: Stage and commit the doc/memory updates**

The BootCamp directory is not a git repo, so the NEXT-SESSION-PROMPT.md and the MEMORY.md updates are uncommitted. That matches the existing convention. No commit needed.

---

## Self-review checklist

After all tasks pass:

1. **Spec coverage:** every numbered decision in the spec has a task. Hex bar (Task 15), capstone shell variant (Task 18 + Task 25), continue-always (Task 16), lesson-complete screen (Task 17, Task 29), full-bleed (Task 14), linear progression (Task 18), `attemptStatus` payload (Task 4), `newAttemptStatus` submit (Task 5), SSE streaming (Tasks 6–8), polling fallback (Task 27), per-renderer test fix (Tasks 20–25), final tsc clean (Task 26 + Task 30).
2. **Placeholder scan:** no "TBD" / "TODO" / "implement appropriate X" left in the plan.
3. **Type consistency:** `ExerciseAttemptStatus` defined once on each side (platform `src/content/types/attempt-status.ts`, web `lib/exercise-payloads.ts`), used uniformly. `newAttemptStatus` field name consistent across `SubmitResponse` (web) and `SubmitResponse` (platform). `onAttempt` prop signature `(status: ExerciseAttemptStatus) => void` identical on every renderer.
4. **Worktree paths:** every platform task names `c:/tmp/bootcamp-platform-lesson`, every web task names `c:/tmp/bootcamp-web-lesson`. No cross-worktree confusion.
5. **Commit trailer:** every commit ends with the Co-Authored-By trailer per CLAUDE.md project convention.
