# Spec #5 — Submission, Grading, Automated Review (Phase 1)

**Date:** 2026-04-12
**Status:** Design approved, awaiting implementation plan
**Depends on:** Specs #1–4 (content model, lesson runtime, code execution, auth — all on `master` at `6ae75d5`)
**Successor specs:** #6 (gamification), #7 (AI code review), #8 (human instructor review)

## Goal

Wire the existing `Attempt`, `ExerciseResult`, and `ScoringService` (built in spec #1, unused since) into a real submission flow. Students can practice with ephemeral "Run" (spec #3, unchanged) and grade themselves with a new "Submit" that persists attempts, updates results, and awards points. Works for all 5 exercise types. The UI shows points after each submission and a running total in the header.

## Non-goals

- Hints UI / hint escalation affecting scoring (spec #6 or standalone)
- Leaderboards, streaks, badges (spec #6)
- AI code review commentary on submissions (spec #7)
- Human instructor review queue (spec #8)
- Structured per-test results ("test 2 of 5 failed")
- Retry limits or cooldown between submissions
- Enrollment flow (Student auto-created on first submit; formal enrollment is a later spec)

## Architecture

### Two user actions, clearly separated

| Action | Endpoint | Persists? | Points? | Available for |
|---|---|---|---|---|
| **Run** (practice) | `POST /api/run` (existing, unchanged) | No | No | `code`, `fix_bug` only |
| **Submit** (graded) | `POST /api/submit` (new) | Yes — creates `Attempt`, updates `ExerciseResult` | Yes — via `ScoringService` | All 5 types |

Students click "Run tests" to iterate freely with no penalty (spec #3 behavior preserved). When confident, they click "Submit" to lock in a graded attempt. The scoring formula penalizes failed attempts (`-5% per failed attempt before pass`), so the distinction matters.

### New module: `SubmissionModule`

```
platform/src/
  submission/
    submission.module.ts
    submit.controller.ts        (POST /api/submit)
    submission.service.ts       (orchestrate: validate → run/check → persist → score)
    server-check.ts             (pure server-side answer validation for MC/fill/predict)
    progress.controller.ts      (GET /api/progress/me)
```

`SubmissionModule` imports `ContentModule` (exercise lookup), `ExecutionModule` (RunnerService for code/fix_bug), `StateModule` (AttemptRepository, ExerciseResult handling, ScoringService), and `AuthModule` (JwtAuthGuard, CurrentUser).

### Submission flow

**For `code` / `fix_bug`:**

```
POST /api/submit {exerciseId, exerciseVersion, code}
  → @UseGuards(JwtAuthGuard)
  → SubmissionService.submit(userId, req)
    → ExerciseRepository.findByVersion(id, version) — 404 if missing/unpublished
    → validate type is code/fix_bug, language present
    → RunnerService.run(language, harness, timeoutMs) — compile + execute
    → ensureStudent(userId) — auto-create Student if none linked
    → count prior failed attempts for this exercise
    → AttemptRepository.create(attempt)
    → ScoringService.score(pointsMax, hintsUsed=0, failedAttemptsBefore, passed)
    → upsert ExerciseResult (update bestAttemptId, passed, pointsEarned, attemptsCount, firstPassedAt)
    → return SubmitResponse
```

**For `multiple_choice` / `fill_blank` / `predict_output`:**

```
POST /api/submit {exerciseId, exerciseVersion, answer}
  → @UseGuards(JwtAuthGuard)
  → SubmissionService.submit(userId, req)
    → ExerciseRepository.findByVersion — 404 if missing/unpublished
    → serverCheck(exercise, answer) → {passed}
    → ensureStudent(userId)
    → count prior failed attempts
    → AttemptRepository.create(attempt)
    → ScoringService.score(...)
    → upsert ExerciseResult
    → return SubmitResponse
```

### Server-side check (`server-check.ts`)

Pure function, mirrors `web/lib/check.ts` logic exactly:

```ts
function serverCheck(exercise: Exercise, answer: unknown): { passed: boolean }
```

- `multiple_choice`: set equality of submitted option ids vs `payload.correctOptionIds`
- `fill_blank`: trimmed, case-sensitive per-blank match against `payload.blanks[i].expected[]`
- `predict_output`: trimmed string equality against `payload.expectedOutput`
- `code` / `fix_bug`: throws (caller should never invoke for these types)

### Auto-create Student

On first submission, `SubmissionService.ensureStudent(userId)` checks if a Student with this `userId` exists. If not, creates one by copying `name` and `email` from the `User` record, generating a new id, and setting `cohortId = null`. Returns the `studentId` for use in Attempt creation.

This means `Student.userId` (currently optional from spec #4's migration) gets populated for all students who submit.

### ExerciseResult upsert logic

After creating the Attempt:

1. Look up existing `ExerciseResult` for `(studentId, exerciseId)`.
2. If none exists: create with `{passed, pointsEarned, attemptsCount: 1, bestAttemptId, firstPassedAt}`.
3. If exists: increment `attemptsCount`. If this attempt passed and the previous best didn't (or this attempt scored higher), update `bestAttemptId`, `passed`, `pointsEarned`, `firstPassedAt`.

The existing `ExerciseResult` model from spec #1 has a `@@unique([studentId, exerciseId])` constraint, so upsert is safe.

### Scoring

Uses the existing `ScoringService.score()` from spec #1:

```
points = max(pointsMax − hints*10% − failedAttemptsBefore*5%, floor=20%) | floor
```

For spec #5, `hintsUsedCount` is always 0 (hints UI is spec #6). `failedAttemptsBefore` is the count of prior Attempts for this `(studentId, exerciseId)` where `passed === false`.

`pointsAwarded` is 0 if the attempt failed. If it passed, it's the scored value. If the student already passed this exercise with a higher score, the `ExerciseResult.pointsEarned` keeps the higher value (best-attempt model).

## API contract

### `POST /api/submit`

Requires `JwtAuthGuard`.

**Request body** (discriminated by presence of `code` vs `answer`):

```ts
type SubmitRequest =
  | { exerciseId: string; exerciseVersion: number; code: string }      // code/fix_bug
  | { exerciseId: string; exerciseVersion: number; answer: unknown };  // MC/fill/predict
```

Validation: `exerciseId` required string, `exerciseVersion` required int. Exactly one of `code` or `answer` must be present.

**Response:**

```ts
type SubmitResponse = {
  passed: boolean;
  pointsAwarded: number;         // points for THIS attempt (0 if failed)
  totalPointsExercise: number;   // best score for this exercise
  totalPoints: number;           // sum across all exercises for this student
  // For code/fix_bug only (from RunnerService):
  outcome?: RunOutcome;          // 'passed' | 'failed' | 'compile_error' | 'timed_out' | 'internal_error'
  stdout?: string;
  stderr?: string;
};
```

**HTTP status codes:**
- 200 — any result, including failed attempts
- 401 — not authenticated
- 404 — exercise not found or not published
- 400 — validation error (missing fields, both code+answer present, etc.)

### `GET /api/progress/me`

Requires `JwtAuthGuard`.

**Response:**

```ts
type ProgressResponse = {
  studentId: string | null;       // null if never submitted
  results: ExerciseResultDTO[];
  totalPoints: number;
};

type ExerciseResultDTO = {
  exerciseId: string;
  passed: boolean;
  pointsEarned: number;
  attemptsCount: number;
  firstPassedAt: string | null;
};
```

Returns empty `results` array and `totalPoints: 0` for a user who has never submitted.

## Web UI changes

### New client

`web/lib/submit.ts`:

```ts
export async function submitExercise(
  exerciseId: string,
  exerciseVersion: number,
  payload: { code: string } | { answer: unknown },
): Promise<SubmitResponse>
```

Uses `credentials: 'include'`. Wraps errors as synthetic `internal_error`.

### Updated renderers

**CodeExercise / FixBugExercise:**
- Keep "Run tests" button (ephemeral, existing behavior)
- Add "Submit" button next to it (calls `submitExercise` with `{code}`)
- When Submit returns: show `RunResult` (existing) for stdout/stderr + new `PointsBadge` for points
- Auth check: if not logged in, "Submit" shows "Sign in to submit" (same pattern as Run)

**MultipleChoiceExercise / FillBlankExercise / PredictOutputExercise:**
- Rename "Check" to "Submit"
- Replace client-side `checkAnswer()` call with `submitExercise(id, version, {answer})`
- Show pass/fail result + `PointsBadge`
- Keep the existing pass/fail text ("Correct!" / "Not quite — try again.") and add the points line
- Auth check: if not logged in, Submit shows "Sign in to submit"

### New component: `PointsBadge`

```tsx
function PointsBadge({ pointsAwarded, totalPointsExercise, totalPoints }: {...}) {
  // Renders: "+20 points (85 total)" on pass, or "0 points this attempt (85 total)" on fail
}
```

### Header points counter

`AppShell.tsx` gets a small points indicator next to the Settings gear: "125 pts". Fetched from `GET /api/progress/me` when the user is authenticated (via AuthProvider or a separate progress context). Updated locally after each Submit response using `totalPoints` from the response.

### Dead code

`web/lib/check.ts` is no longer called by any renderer. It can be deleted in this spec or left as dead code — prefer deletion to keep things clean.

## Testing

| Layer | Tool | Coverage |
|---|---|---|
| `serverCheck` (pure) | Jest | MC set equality, fill_blank trimmed case-sensitive, predict_output trimmed, throws for code/fix_bug |
| `SubmissionService` (mocked deps) | Jest | Code happy path (passed → points), code failed (0 points), MC happy path, fill_blank happy path, predict_output happy path, auto-creates Student on first submit, rejects unpublished exercise, increments attemptsCount on repeated submits, respects best-attempt (higher score kept) |
| `SubmitController` HTTP | Jest + supertest | 200 for code submit, 200 for MC submit, 401 without auth, 404 missing exercise, 400 on invalid body |
| `ProgressController` HTTP | Jest + supertest | 200 with results, 200 empty for new user, 401 without auth |
| Scoring integration | Jest | SubmissionService → ScoringService produces correct points for 0, 1, 5 failed attempts before pass |
| Web `lib/submit.ts` | Vitest | Mocked fetch for pass/fail/error |
| `PointsBadge` | Vitest + RTL | Renders points on pass, 0 on fail, shows total |
| MC/Fill/Predict renderers | Vitest + RTL | Submit button calls `submitExercise`, shows PointsBadge |
| Code/FixBug renderers | Vitest + RTL | Run still works (no points), Submit shows points |
| Playwright | Playwright | Register → submit MC → see points → submit code → see cumulative → header counter updates |

## Success criteria

1. Student clicks "Submit" on correct MC answer → "Correct! +100 points (100 total)" shown. `Attempt` row created in DB. `ExerciseResult` created.
2. Student clicks "Submit" on wrong MC → "Not quite" with 0 points. Then submits correct → points reduced by 5% (`max(100 - 5, 20) = 95 points`).
3. "Run tests" on code exercise → ephemeral result, no points, no DB write.
4. "Submit" on code exercise → result + points badge. Attempt persisted.
5. `GET /api/progress/me` returns exercise results and cumulative total.
6. First submission auto-creates Student linked to User.
7. Header shows running points total, updates after each submit.
8. `web/lib/check.ts` deleted or unused — all 5 types go through `/api/submit`.
9. All prior tests pass (specs #1–4 unaffected).

## Architectural decisions

1. **Run vs Submit separation.** Run is ephemeral practice; Submit is graded. The scoring formula's `failedAttemptsBefore` penalty makes this distinction important — students should be able to experiment freely without score impact.
2. **Server-side check for MC/fill/predict.** Moves answer validation to the backend so the grading flow is uniform across all 5 types. `web/lib/check.ts` client-side checking is removed.
3. **Auto-create Student.** Bridges the User → Student gap from spec #4 without a separate enrollment flow. First submit = first enrollment. Formal cohort assignment remains manual (spec #8).
4. **Best-attempt model.** `ExerciseResult` stores the highest-scoring attempt. Repeated passing submissions can only improve (never worsen) the student's score for an exercise.
5. **`hintsUsedCount` is always 0.** Hints UI doesn't exist yet. The scoring formula already supports it; spec #6 will wire hints.
6. **`POST /api/submit` always returns 200.** Failed attempts are valid outcomes, not errors. Consistent with `/api/run`.
