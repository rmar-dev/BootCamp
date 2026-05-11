# Capstone Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the lesson platform to real-world capstone projects with milestone submissions, instructor-gated approval, and starter-repo handout.

**Architecture:** New `capstone_submission` exercise type with its own Zod schemas (exercise payload + submission payload). SubmissionService extended to skip execution for capstones. Instructor approval endpoint on InstructorReviewController. Web gets a new `CapstoneSubmissionExercise` renderer and instructor page adaptations. Curriculum compiler extended with `starterRepoUrl` and capstone exercise support.

**Tech Stack:** NestJS, Prisma, Next.js 14, Tailwind CSS, Vitest (web/curriculum), Jest (platform).

---

## File Structure

### Platform (modified)

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add `starterRepoUrl` to Track, `approvedByInstructorId` to Attempt, `capstone_submission` to ExerciseType enum |
| `src/content/types/exercise-type.enum.ts` | Add `capstone_submission` to values array |
| `src/content/types/exercise-payload.types.ts` | Add `CapstoneSubmissionPayload` type |
| `src/content/types/submission-payload.types.ts` | Add `CapstoneSubmission` type |
| `src/content/validators/exercise-payload.validator.ts` | Add `capstoneSubmissionSchema` |
| `src/content/validators/submission-payload.validator.ts` | Add `capstoneSubmissionSchema` |
| `src/submission/submission.service.ts` | Handle `capstone_submission` in submit flow |
| `src/submission/submit.controller.ts` | Add `repoUrl`, `commitSha`, `notes` to SubmitDto |
| `src/instructor-review/instructor-review.controller.ts` | Add `PUT approve/:attemptId` endpoint |
| `src/instructor-review/instructor-review.service.ts` | Add `approveAttempt()` method, extend queue for capstone items |
| `test/helpers/db.ts` | No change needed (Attempt already cleaned up) |

### Web (new + modified)

| File | Responsibility |
|------|---------------|
| `components/lesson/renderers/CapstoneSubmissionExercise.tsx` | New renderer for capstone submission form |
| `components/lesson/ExerciseBlock.tsx` | Add `capstone_submission` case |
| `lib/instructor.ts` | Add `approveCapstone()` fetch helper |
| `lib/submit.ts` | Extend `submitExercise` for capstone fields |
| `app/instructor/review/[attemptId]/page.tsx` | Adapt left pane for capstone, add approve button |

### Curriculum (modified)

| File | Responsibility |
|------|---------------|
| `src/parser.ts` | Add `starterRepoUrl` to `TrackMeta` |
| `src/validator.ts` | Add `capstone_submission` case |
| `src/compiler.ts` | Write `starterRepoUrl` to Track |

---

## Task 1: Schema Changes — ExerciseType, Track, Attempt

**Files:**
- Modify: `platform/prisma/schema.prisma`
- Modify: `platform/src/content/types/exercise-type.enum.ts`

- [ ] **Step 1: Add `capstone_submission` to ExerciseType enum in schema**

In `platform/prisma/schema.prisma`, find the `ExerciseType` enum (currently has code, fix_bug, fill_blank, predict_output, multiple_choice) and add `capstone_submission`:

```prisma
enum ExerciseType {
  code
  fix_bug
  fill_blank
  predict_output
  multiple_choice
  capstone_submission
}
```

- [ ] **Step 2: Add `starterRepoUrl` to Track model**

In the Track model, add after `contentHash`:

```prisma
  starterRepoUrl  String?
```

- [ ] **Step 3: Add `approvedByInstructorId` to Attempt model**

In the Attempt model, add after `pointsAwarded`:

```prisma
  approvedByInstructorId  String?  @db.Uuid
```

- [ ] **Step 4: Update TypeScript enum**

In `platform/src/content/types/exercise-type.enum.ts`:

```typescript
export const ExerciseTypeValues = [
  'code',
  'fix_bug',
  'fill_blank',
  'predict_output',
  'multiple_choice',
  'capstone_submission',
] as const;

export type ExerciseTypeValue = (typeof ExerciseTypeValues)[number];
```

- [ ] **Step 5: Run migration**

Run: `cd platform && npx prisma migrate dev --name add-capstone-bridge`
Expected: Migration created and applied.

- [ ] **Step 6: Run tests**

Run: `cd platform && npm test`
Expected: All 187 tests pass.

- [ ] **Step 7: Commit**

```bash
cd platform
git add prisma/schema.prisma prisma/migrations/ src/content/types/exercise-type.enum.ts
git commit -m "feat: add capstone_submission type, starterRepoUrl, approvedByInstructorId"
```

---

## Task 2: Payload Types and Validators

**Files:**
- Modify: `platform/src/content/types/exercise-payload.types.ts`
- Modify: `platform/src/content/types/submission-payload.types.ts`
- Modify: `platform/src/content/validators/exercise-payload.validator.ts`
- Modify: `platform/src/content/validators/submission-payload.validator.ts`

- [ ] **Step 1: Add CapstoneSubmissionPayload type**

In `platform/src/content/types/exercise-payload.types.ts`, add after `MultipleChoicePayload`:

```typescript
export type CapstoneSubmissionPayload = {
  type: 'capstone_submission';
};
```

Update the union type:

```typescript
export type ExercisePayload =
  | CodePayload
  | FixBugPayload
  | FillBlankPayload
  | PredictOutputPayload
  | MultipleChoicePayload
  | CapstoneSubmissionPayload;
```

- [ ] **Step 2: Add CapstoneSubmission type**

In `platform/src/content/types/submission-payload.types.ts`, add:

```typescript
export type CapstoneSubmission = {
  type: 'capstone_submission';
  repoUrl: string;
  commitSha: string;
  notes: string;
};
```

Update the union type:

```typescript
export type SubmissionPayload =
  | CodeSubmission
  | FixBugSubmission
  | FillBlankSubmission
  | PredictOutputSubmission
  | MultipleChoiceSubmission
  | CapstoneSubmission;
```

- [ ] **Step 3: Add exercise payload Zod schema**

In `platform/src/content/validators/exercise-payload.validator.ts`, add:

```typescript
const capstoneSubmissionSchema = z.object({
  type: z.literal('capstone_submission'),
});
```

Add to `schemaByType`:

```typescript
const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSchema,
  fix_bug: fixBugSchema,
  fill_blank: fillBlankSchema,
  predict_output: predictOutputSchema,
  multiple_choice: multipleChoiceSchema,
  capstone_submission: capstoneSubmissionSchema,
};
```

- [ ] **Step 4: Add submission payload Zod schema**

In `platform/src/content/validators/submission-payload.validator.ts`, add:

```typescript
const capstoneSubmissionSchema = z.object({
  type: z.literal('capstone_submission'),
  repoUrl: z.string().url(),
  commitSha: z.string().min(7),
  notes: z.string(),
});
```

Add to `schemaByType`:

```typescript
const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSubmissionSchema,
  fix_bug: fixBugSubmissionSchema,
  fill_blank: fillBlankSubmissionSchema,
  predict_output: predictOutputSubmissionSchema,
  multiple_choice: multipleChoiceSubmissionSchema,
  capstone_submission: capstoneSubmissionSchema,
};
```

- [ ] **Step 5: Run tests**

Run: `cd platform && npm test`
Expected: All 187 tests pass.

- [ ] **Step 6: Commit**

```bash
cd platform
git add src/content/types/ src/content/validators/
git commit -m "feat: add capstone_submission payload types and Zod schemas"
```

---

## Task 3: Submission Service — Handle Capstone Type

**Files:**
- Modify: `platform/src/submission/submission.service.ts`
- Modify: `platform/src/submission/submit.controller.ts`

- [ ] **Step 1: Extend SubmitDto with capstone fields**

In `platform/src/submission/submit.controller.ts`, add fields to `SubmitDto`:

```typescript
class SubmitDto {
  @IsString()
  @MinLength(1)
  exerciseId: string;

  @IsInt()
  exerciseVersion: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  answer?: unknown;

  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

Update the `submit` method to pass the new fields:

```typescript
  async submit(
    @CurrentUser() user: { userId: string; email: string; role: string },
    @Body() dto: SubmitDto,
  ) {
    return this.submission.submit(user.userId, {
      exerciseId: dto.exerciseId,
      exerciseVersion: dto.exerciseVersion,
      code: dto.code,
      answer: dto.answer,
      repoUrl: dto.repoUrl,
      commitSha: dto.commitSha,
      notes: dto.notes,
    });
  }
```

- [ ] **Step 2: Extend SubmitRequest type**

In `platform/src/submission/submission.service.ts`, update `SubmitRequest`:

```typescript
export type SubmitRequest = {
  exerciseId: string;
  exerciseVersion: number;
  code?: string;
  answer?: unknown;
  repoUrl?: string;
  commitSha?: string;
  notes?: string;
};
```

- [ ] **Step 3: Add capstone handling to submit method**

In the `submit` method of `SubmissionService`, add the capstone case. In the answer-checking block (after `} else {`), add a capstone branch:

```typescript
    if (payload.type === 'code' || payload.type === 'fix_bug') {
      const runResponse = await this.runner.run({
        exerciseId: req.exerciseId,
        exerciseVersion: req.exerciseVersion,
        code: req.code!,
      });
      passed = runResponse.passed;
      outcome = runResponse.outcome;
      stdout = runResponse.stdout;
      stderr = runResponse.stderr;
    } else if (payload.type === 'capstone_submission') {
      // Capstone submissions are never auto-graded
      passed = false;
      outcome = 'pending_review';
    } else {
      const checkResult = serverCheck(payload, req.answer);
      passed = checkResult.passed;
    }
```

In the submission payload switch, add the capstone case:

```typescript
      case 'capstone_submission':
        submissionPayload = {
          type: 'capstone_submission',
          repoUrl: req.repoUrl!,
          commitSha: req.commitSha!,
          notes: req.notes ?? '',
        };
        break;
```

- [ ] **Step 4: Run tests**

Run: `cd platform && npm test`
Expected: All 187 tests pass.

- [ ] **Step 5: Commit**

```bash
cd platform
git add src/submission/
git commit -m "feat: handle capstone_submission in submission pipeline"
```

---

## Task 4: Instructor Approval Endpoint

**Files:**
- Modify: `platform/src/instructor-review/instructor-review.service.ts`
- Modify: `platform/src/instructor-review/instructor-review.controller.ts`

- [ ] **Step 1: Add approveAttempt method to service**

In `platform/src/instructor-review/instructor-review.service.ts`, add this method:

```typescript
  async approveAttempt(
    attemptId: string,
    instructorId: string,
  ): Promise<{ attempt: any; exerciseResult: any }> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new Error('Attempt not found');

    // Verify it's a capstone exercise
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: attempt.exerciseId },
      orderBy: { version: 'desc' },
    });
    if (!exercise || exercise.type !== 'capstone_submission') {
      throw new Error('Not a capstone submission');
    }

    if (attempt.approvedByInstructorId) {
      throw new Error('Already approved');
    }

    // Approve: set passed, award points
    const pointsAwarded = exercise.pointsMax;
    const updatedAttempt = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        passed: true,
        pointsAwarded,
        approvedByInstructorId: instructorId,
      },
    });

    // Update ExerciseResult
    const existingResult = await this.prisma.exerciseResult.findFirst({
      where: { studentId: attempt.studentId, exerciseId: attempt.exerciseId },
    });

    let exerciseResult;
    if (existingResult) {
      exerciseResult = await this.prisma.exerciseResult.update({
        where: { id: existingResult.id },
        data: {
          passed: true,
          bestAttemptId: attemptId,
          pointsEarned: Math.max(existingResult.pointsEarned, pointsAwarded),
          firstPassedAt: existingResult.firstPassedAt ?? new Date(),
        },
      });
    } else {
      const { newId } = await import('../shared/ids');
      exerciseResult = await this.prisma.exerciseResult.create({
        data: {
          id: newId(),
          studentId: attempt.studentId,
          exerciseId: attempt.exerciseId,
          bestAttemptId: attemptId,
          passed: true,
          pointsEarned: pointsAwarded,
          attemptsCount: 1,
          firstPassedAt: new Date(),
        },
      });
    }

    return { attempt: updatedAttempt, exerciseResult };
  }
```

- [ ] **Step 2: Add capstone items to the queue**

In `platform/src/instructor-review/instructor-review.service.ts`, update the `QueueItem` type to include a `queueType` field:

```typescript
export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  queueType: 'code_review' | 'capstone_approval';
};
```

Add a method to get pending capstone submissions and merge them into the queue. At the end of the `getQueue` method (before the return), add capstone items for the pending queue:

```typescript
    // Add pending capstone submissions (only for pending queue)
    if (!reviewed) {
      const capstoneAttempts = await this.prisma.attempt.findMany({
        where: {
          studentId: { in: studentIds },
          approvedByInstructorId: null,
          passed: false,
        },
      });

      for (const attempt of capstoneAttempts) {
        const exercise = await this.prisma.exercise.findFirst({
          where: { id: attempt.exerciseId },
          orderBy: { version: 'desc' },
        });
        if (!exercise || exercise.type !== 'capstone_submission') continue;

        const block = await this.prisma.block.findFirst({
          where: { exerciseId: attempt.exerciseId },
        });
        let lessonTitle = 'Unknown';
        if (block) {
          const lesson = await this.prisma.lesson.findFirst({
            where: { id: block.lessonId },
          });
          if (lesson) lessonTitle = lesson.title;
        }

        const student = studentMap.get(attempt.studentId);
        if (!student) continue;

        items.push({
          attemptId: attempt.id,
          studentName: student.name,
          studentEmail: student.email,
          exerciseId: attempt.exerciseId,
          exercisePrompt: exercise.promptMarkdown,
          lessonTitle,
          submittedAt: attempt.submittedAt,
          reviewedAt: null,
          queueType: 'capstone_approval',
        });
      }
    }
```

Also set `queueType: 'code_review'` on the existing items in the loop above.

- [ ] **Step 3: Add approve endpoint to controller**

In `platform/src/instructor-review/instructor-review.controller.ts`, add:

```typescript
  @Put('approve/:attemptId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async approveAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string },
  ) {
    try {
      return await this.service.approveAttempt(attemptId, user.userId);
    } catch (err) {
      if (err.message === 'Attempt not found') throw new NotFoundException(err.message);
      if (err.message === 'Not a capstone submission') throw new ForbiddenException(err.message);
      if (err.message === 'Already approved') throw new ConflictException(err.message);
      throw err;
    }
  }
```

- [ ] **Step 4: Run tests**

Run: `cd platform && npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd platform
git add src/instructor-review/
git commit -m "feat: add capstone approval endpoint and queue integration"
```

---

## Task 5: Platform E2E Tests — Capstone Submission + Approval

**Files:**
- Create: `platform/test/capstone/capstone.controller.spec.ts`

- [ ] **Step 1: Write E2E tests**

Create `platform/test/capstone/capstone.controller.spec.ts` following the pattern from `test/instructor-review/instructor-review.controller.spec.ts`:

Tests to write:
1. `POST /api/submit` with capstone_submission creates Attempt with `passed: false` and `approvedByInstructorId: null`
2. `POST /api/submit` with capstone_submission rejects missing repoUrl
3. `PUT /api/instructor/approve/:attemptId` sets passed: true, awards points, updates ExerciseResult
4. `PUT /api/instructor/approve/:attemptId` returns 404 for non-existent attempt
5. `PUT /api/instructor/approve/:attemptId` returns 403 for non-capstone exercise
6. `PUT /api/instructor/approve/:attemptId` returns 409 for already-approved attempt
7. `PUT /api/instructor/approve/:attemptId` returns 403 for student role
8. `GET /api/instructor/queue` includes pending capstone submissions
9. Resubmission creates new Attempt, old stays passed: false

Use helpers: `registerAndGetCookie`, `seedCohortAndStudent`, plus a new `seedCapstoneExercise` helper that creates an Exercise with `type: 'capstone_submission'`, payload `{ type: 'capstone_submission' }`, a Lesson, Block, and publishes them.

- [ ] **Step 2: Run tests**

Run: `cd platform && npm test -- --testPathPattern=capstone`
Expected: All tests pass.

- [ ] **Step 3: Run full suite**

Run: `cd platform && npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd platform
git add test/capstone/
git commit -m "test: add capstone submission and approval e2e tests"
```

---

## Task 6: Web — CapstoneSubmissionExercise Renderer

**Files:**
- Create: `web/components/lesson/renderers/CapstoneSubmissionExercise.tsx`
- Modify: `web/components/lesson/ExerciseBlock.tsx`
- Modify: `web/lib/submit.ts`

- [ ] **Step 1: Extend submitExercise for capstone fields**

In `web/lib/submit.ts`, update the `submitExercise` function signature to accept capstone fields:

```typescript
export async function submitExercise(
  exerciseId: string,
  exerciseVersion: number,
  payload: { code: string } | { answer: unknown } | { repoUrl: string; commitSha: string; notes: string },
): Promise<SubmitResponse> {
```

The body is already `JSON.stringify({ exerciseId, exerciseVersion, ...payload })` which spreads the fields correctly.

- [ ] **Step 2: Create CapstoneSubmissionExercise component**

Create `web/components/lesson/renderers/CapstoneSubmissionExercise.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { ExerciseDTO } from '@/lib/exercise-payloads';
import { submitExercise, type SubmitResponse } from '@/lib/submit';
import { PointsBadge } from './PointsBadge';
import { InstructorReview } from './InstructorReview';
import { useAuth } from '@/components/layout/AuthProvider';

export function CapstoneSubmissionExercise({ exercise }: { exercise: ExerciseDTO }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [submitAttemptId, setSubmitAttemptId] = useState<string | null>(null);
  const { user, setTotalPoints } = useAuth();

  async function onSubmit() {
    if (!user || !repoUrl.trim() || !commitSha.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitExercise(exercise.id, exercise.version, {
        repoUrl: repoUrl.trim(),
        commitSha: commitSha.trim(),
        notes: notes.trim(),
      });
      setSubmitResult(res);
      setSubmitAttemptId(res.attemptId || null);
      if (res.passed) setTotalPoints(res.totalPoints);
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = submitResult && !submitResult.passed;
  const isApproved = submitResult?.passed;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Repository URL
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/you/your-project"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Commit SHA
          </label>
          <input
            type="text"
            value={commitSha}
            onChange={(e) => setCommitSha(e.target.value)}
            placeholder="abc1234"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Notes (build output, test results, etc.)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your build output or any notes for the instructor..."
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !repoUrl.trim() || !commitSha.trim()}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
        >
          {submitting ? 'Submitting...' : 'Submit Milestone'}
        </button>
      </div>

      {isPending && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800/60 dark:bg-yellow-950/40">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Pending Review — your instructor will review this submission.
          </p>
        </div>
      )}

      {isApproved && submitResult && (
        <PointsBadge
          passed={true}
          pointsAwarded={submitResult.pointsAwarded}
          totalPoints={submitResult.totalPoints}
        />
      )}

      <InstructorReview attemptId={submitAttemptId} />
    </div>
  );
}
```

- [ ] **Step 3: Add to ExerciseBlock switch**

In `web/components/lesson/ExerciseBlock.tsx`, add the import and case:

```typescript
import { CapstoneSubmissionExercise } from './renderers/CapstoneSubmissionExercise';
```

Add to the switch:

```typescript
    case 'capstone_submission': return <CapstoneSubmissionExercise exercise={exercise} />;
```

- [ ] **Step 4: Commit**

```bash
cd web
git add components/lesson/renderers/CapstoneSubmissionExercise.tsx components/lesson/ExerciseBlock.tsx lib/submit.ts
git commit -m "feat: add CapstoneSubmissionExercise renderer"
```

---

## Task 7: Web — Instructor Page Adaptations

**Files:**
- Modify: `web/lib/instructor.ts`
- Modify: `web/app/instructor/review/[attemptId]/page.tsx`

- [ ] **Step 1: Add approve helper to instructor lib**

In `web/lib/instructor.ts`, add:

```typescript
export async function approveCapstone(
  attemptId: string,
): Promise<{ attempt: any; exerciseResult: any }> {
  const res = await authFetch(`/api/instructor/approve/${attemptId}`, {
    method: 'PUT',
  });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}
```

Also update `QueueItem` type to include `queueType`:

```typescript
export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: string;
  reviewedAt: string | null;
  queueType?: 'code_review' | 'capstone_approval';
};
```

- [ ] **Step 2: Adapt instructor review detail page**

In `web/app/instructor/review/[attemptId]/page.tsx`, the left pane currently always shows a Monaco editor. Modify it to check the attempt detail's exercise type. If it's a `capstone_submission`, show the repo URL, commit SHA, and notes instead of Monaco.

Add to the `AttemptDetail` type (or extend it):

```typescript
// The detail already has code, language, etc. For capstone, code will be empty
// and submissionPayload will contain { repoUrl, commitSha, notes }
```

In the left pane rendering, replace the Monaco section with a conditional:

```tsx
{/* Left pane */}
<div className="space-y-4">
  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
    {detail.language === 'plaintext' ? 'Submission' : 'Student Code'}
  </h2>
  {detail.code ? (
    /* existing Monaco editor */
  ) : (
    /* Capstone submission details */
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Parse submissionPayload for repoUrl, commitSha, notes */}
    </div>
  )}
</div>
```

Add an "Approve Milestone" button in the right pane, below the review form, visible when the attempt is a capstone and not yet approved:

```tsx
{detail.language === 'plaintext' && !detail.passed && (
  <button
    type="button"
    onClick={handleApprove}
    className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500"
  >
    Approve Milestone
  </button>
)}
```

The `handleApprove` function calls `approveCapstone(attemptId)` and refreshes the page data.

Note: The attempt detail endpoint needs to include the `submissionPayload` and `approvedByInstructorId` fields. Update the `getAttemptDetail` method in `InstructorReviewService` to return these.

- [ ] **Step 3: Commit**

```bash
cd web
git add lib/instructor.ts app/instructor/review/
git commit -m "feat: adapt instructor review page for capstone approvals"
```

---

## Task 8: Web Tests

**Files:**
- Create: `web/tests/renderers/CapstoneSubmissionExercise.test.tsx`

- [ ] **Step 1: Write component tests**

Create `web/tests/renderers/CapstoneSubmissionExercise.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapstoneSubmissionExercise } from '@/components/lesson/renderers/CapstoneSubmissionExercise';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'student' }, setTotalPoints: vi.fn() }),
}));

const exercise = {
  id: 'ex-1',
  version: 1,
  type: 'capstone_submission' as const,
  promptMarkdown: 'Submit your milestone.',
  payload: { type: 'capstone_submission' },
  pointsMax: 50,
  hints: [],
};

describe('CapstoneSubmissionExercise', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('renders repo URL, commit SHA, and notes fields', () => {
    render(<CapstoneSubmissionExercise exercise={exercise} />);
    expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/abc1234/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/build output/i)).toBeInTheDocument();
  });

  it('renders Submit Milestone button', () => {
    render(<CapstoneSubmissionExercise exercise={exercise} />);
    expect(screen.getByText('Submit Milestone')).toBeInTheDocument();
  });

  it('disables submit when fields are empty', () => {
    render(<CapstoneSubmissionExercise exercise={exercise} />);
    const button = screen.getByText('Submit Milestone');
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd web && npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd web
git add tests/renderers/CapstoneSubmissionExercise.test.tsx
git commit -m "test: add CapstoneSubmissionExercise component tests"
```

---

## Task 9: Curriculum Compiler — Capstone Support

**Files:**
- Modify: `curriculum/src/parser.ts`
- Modify: `curriculum/src/validator.ts`
- Modify: `curriculum/src/compiler.ts`

- [ ] **Step 1: Add starterRepoUrl to TrackMeta**

In `curriculum/src/parser.ts`, update the `TrackMeta` type:

```typescript
export type TrackMeta = {
  id: string;
  title: string;
  language: 'swift' | 'kotlin';
  kind: 'placement' | 'fundamentals' | 'capstone';
  description: string;
  lessons: string[];
  starterRepoUrl?: string;
};
```

Update `parseTrackFile` to extract `starterRepoUrl`:

```typescript
export function parseTrackFile(content: string): TrackMeta {
  const { data } = matter(content);
  return {
    id: data.id,
    title: data.title,
    language: data.language,
    kind: data.kind,
    description: data.description,
    lessons: data.lessons ?? [],
    starterRepoUrl: data.starterRepoUrl,
  };
}
```

- [ ] **Step 2: Add capstone_submission to validator**

In `curriculum/src/validator.ts`, add a new case in the `buildExercisePayload` switch:

```typescript
    case 'capstone_submission': {
      return {
        payload: { type: 'capstone_submission' },
        errors: [],
      };
    }
```

- [ ] **Step 3: Write starterRepoUrl to Track in compiler**

In `curriculum/src/compiler.ts`, find where the Track is created (`prisma.track.create`) and add `starterRepoUrl`:

```typescript
    await prisma.track.create({
      data: {
        id: trackId,
        version: trackVersion,
        title: trackMeta.title,
        language: trackMeta.language as any,
        kind: trackMeta.kind as any,
        description: trackMeta.description,
        lessonIds,
        lessonVersions,
        contentHash: trackHash,
        starterRepoUrl: trackMeta.starterRepoUrl ?? null,
      },
    });
```

- [ ] **Step 4: Run curriculum tests**

Run: `cd curriculum && npx vitest run`
Expected: All 68 tests pass.

- [ ] **Step 5: Commit**

```bash
cd curriculum
git add src/parser.ts src/validator.ts src/compiler.ts
git commit -m "feat: add capstone_submission and starterRepoUrl to curriculum compiler"
```

---

## Task 10: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run platform tests**

Run: `cd platform && npm test`
Expected: All tests pass.

- [ ] **Step 2: Run web tests**

Run: `cd web && npm test`
Expected: All tests pass.

- [ ] **Step 3: Run web build**

Run: `cd web && npm run build`
Expected: Clean build.

- [ ] **Step 4: Run curriculum tests**

Run: `cd curriculum && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Compile sample curriculum**

Run: `cd curriculum && DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" npx tsx compile.ts`
Expected: Compiles without errors.
