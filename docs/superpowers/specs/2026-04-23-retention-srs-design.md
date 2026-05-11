# Retention Loop — SRS Review Queue (Sub-project B1)

**Date:** 2026-04-23
**Status:** Design approved
**Depends on:** Specs #1 (content model), #5 (submission + grading), #6 (gamification/streak)
**Part of:** "Improve BootCamp" initiative — Sub-project B split into **B1 (this spec, SRS review queue)** and **B2 (struggle detection nudges, later)**.

## Summary

Add a lightweight spaced-repetition system that brings students back to quiz exercises they previously struggled with. A new `ReviewCard` table tracks per-card scheduling state; a new `ReviewQueueModule` exposes queue + review endpoints; a dashboard widget and a dedicated `/review` page let students work through due cards. Only `fill_blank`, `predict_output`, and `multiple_choice` exercises are eligible. Entry is struggle-gated — cards are created only when the student's first pass used `failedAttemptsBefore > 0` OR `hintsUsedCount > 0`. Schedule: `3d → 7d → 21d → 60d → retired`, with conservative reset-to-step-1 on a failed review. Reviews contribute to the streak only — not to points, not to concept-mastery counts from Sub-project A.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Eligible exercise types | `fill_blank`, `predict_output`, `multiple_choice` only | SRS is most effective on short recall items; code exercises provide retention via later hands-on use |
| Scheduling algorithm | Fixed intervals, auto-graded, conservative reset | Cards are objective quiz items — no need for subjective Anki-style self-rating; SM-2 / FSRS are overkill for the ~tens-to-low-hundreds card count per student |
| Card entry trigger | Only on struggled first pass (`failedAttemptsBefore > 0 \|\| hintsUsedCount > 0`) | Respect the student's time; queue stays a corrective tool, not a mandatory schedule |
| Intervals | `[3, 7, 21, 60]` days, retire after step 4 pass | ~1:3 ratio between steps matches research-backed spacing without review fatigue |
| Fail behaviour | Reset `step = 1, nextDueAt = now + 3d` | Standard SRS semantics — if recall failed at day 21, the spacing ladder should restart |
| Review side effects | Streak yes; points no; concept-mastery no | Preserve "streak = daily habit" signal; keep points and mastery tied to original learning |
| UI placement | Dashboard widget + dedicated `/review` page | Matches existing dashboard-centric UX; one-card-at-a-time focused session |
| Daily cap | None | Show all due cards; student stops whenever. Add cap later if overload surfaces in data |
| Queue ordering | `nextDueAt ASC` | Oldest-due first |

## Data Model

Two new Prisma tables. No changes to existing tables.

```prisma
model ReviewCard {
  id             String    @id @db.Uuid
  studentId      String    @db.Uuid
  exerciseId     String    @db.Uuid   // NOT versioned — card follows the latest published version
  step           Int                    // 1..4
  nextDueAt      DateTime
  lastReviewedAt DateTime?
  createdAt      DateTime  @default(now())
  retiredAt      DateTime?              // set when step advances past 4; card no longer scheduled

  @@unique([studentId, exerciseId])
  @@index([studentId, nextDueAt])       // the "what's due" query
  @@index([studentId, retiredAt])
}

model ReviewAttempt {
  id           String   @id @db.Uuid
  reviewCardId String   @db.Uuid
  studentId    String   @db.Uuid        // denormalized for streak queries
  exerciseId   String   @db.Uuid        // denormalized
  submittedAt  DateTime @default(now())
  passed       Boolean

  @@index([studentId, submittedAt])     // streak calc
  @@index([reviewCardId])
}
```

### Card Lifecycle

1. **Create** — when `SubmissionService` records a passing `Attempt` on a quiz exercise AND `failedAttemptsBefore > 0 || hintsUsedCount > 0` AND no `ReviewCard` exists yet for `(studentId, exerciseId)`. Initial state: `step = 1, nextDueAt = now() + 3d`. Unique constraint ensures idempotency on retries.
2. **Review pass** — set `lastReviewedAt = now()`. If `step + 1 > 4`, set `retiredAt = now()` and leave `nextDueAt` frozen (filtered out of queries by `retiredAt IS NULL`). Otherwise `step += 1, nextDueAt = now() + INTERVALS_DAYS[step-1]`.
3. **Review fail** — `step = 1, nextDueAt = now() + 3d, lastReviewedAt = now()`. Card stays active.
4. **Source exercise unpublished** — card is filtered out at query time (service checks for latest published version of `exerciseId`; if none, card is skipped). No card is ever deleted automatically.

### Streak Integration

`StreakService.getCurrentStreak` currently groups `Attempt.submittedAt` by UTC day to count consecutive-days-with-activity. Update: union the `submittedAt` dates from both `Attempt` (for the calling student) and `ReviewAttempt` when building the date set. A day with only review activity still contributes to the streak. Points calculation and badge checks remain unchanged — only the streak query is touched.

## API Endpoints

Both routes under `/api/review`. Both guarded by `JwtAuthGuard`.

### `GET /api/review/queue`

Returns the calling student's due cards with enough exercise data for the client to render the quiz.

```typescript
type ReviewQueueResponse = {
  due: Array<{
    cardId: string;
    exerciseId: string;
    step: number;
    dueAt: string;     // ISO
    exercise: {
      id: string;
      version: number;
      type: 'fill_blank' | 'predict_output' | 'multiple_choice';
      promptMarkdown: string;
      payload: Json;     // the rendering payload (same shape the lesson page uses)
      pointsMax: number;
    };
  }>;
};
```

**Filters:** only cards where `nextDueAt <= now()` AND `retiredAt IS NULL` AND the exercise has at least one currently-published version.
**Ordering:** `nextDueAt ASC` (oldest-due first).
**Empty queue:** returns `{ due: [] }` (200).

### `POST /api/review/:cardId/submit`

Student submits a review answer.

```typescript
// Request body: same shape as the submission payload for the exercise type
//   (validated against the existing SubmissionPayload Zod schema)
type ReviewSubmitResponse = {
  passed: boolean;
  card: {
    step: number;
    nextDueAt: string | null;    // null when retired
    retiredAt: string | null;
  };
};
```

**Implementation:**
- Reuses the existing `server-check` auto-grader from `SubmissionModule` to determine `passed`. The grading helper is exposed as a public service method (no duplication).
- Writes exactly one row to `ReviewAttempt` (studentId denormalized for streak queries).
- Updates the `ReviewCard` row per the lifecycle rules.
- Returns new card state so the client can advance.

**Error cases:**
- **401** — no auth.
- **404** — card doesn't exist, doesn't belong to the calling student, OR the source exercise has no published version.
- **409** — card is already retired (defensive — the UI shouldn't allow this, but the API guards).
- **400** — submission payload doesn't match the exercise type (Zod validation).

### Deliberately Not Included

- No `POST /api/review/cards` — cards are only created server-side by `SubmissionService`'s hook, never by client request.
- No "postpone" / "skip" endpoint.
- No admin / instructor endpoints — instructors cannot see or manage student review queues in B1.

## Module Architecture

New `ReviewQueueModule` (the name avoids collision with the existing `ReviewModule` used for AI code review and `InstructorReviewModule` used for human reviews).

### New Files

| File | Responsibility |
|---|---|
| `src/review-queue/review-queue.module.ts` | Module registration |
| `src/review-queue/review-queue.controller.ts` | Two routes |
| `src/review-queue/review-queue.service.ts` | Queue listing, review submission, card lifecycle logic |
| `src/review-queue/intervals.ts` | `const INTERVALS_DAYS = [3, 7, 21, 60];` + `intervalFor(step)` helper |
| `test/review-queue/review-queue.service.spec.ts` | Unit tests for scheduling + eligibility |
| `test/review-queue/review-queue.controller.spec.ts` | E2E tests |

### Modifications

| File | Change |
|---|---|
| `src/submission/submission.service.ts` | After a passing attempt, call `ReviewQueueService.handleSubmission(studentId, attempt)` |
| `src/gamification/streak.service.ts` | `getCurrentStreak` unions `Attempt.submittedAt` + `ReviewAttempt.submittedAt` |
| `src/submission/submission.module.ts` | Export the server-check grading helper (promote from internal to public service method) |
| `src/app.module.ts` | Register `ReviewQueueModule` |
| `prisma/schema.prisma` | Add `ReviewCard` + `ReviewAttempt` models |

### Module Dependencies

`ReviewQueueModule` imports:
- `PrismaModule` — direct Prisma access for the new tables
- `AuthModule` — `JwtAuthGuard`
- `StateModule` — `StudentRepository` (userId → studentId resolution)
- `ContentModule` — `ExerciseRepository` (fetch latest published exercise version for queue items)
- `SubmissionModule` — reuse the server-check auto-grader

### Key Service Methods

```typescript
class ReviewQueueService {
  // Called by SubmissionService after each passing attempt. Idempotent.
  handleSubmission(studentId: string, attempt: Attempt): Promise<void>;

  // Queue endpoint data — filters by due/not-retired/exercise-published and sorts.
  getDueCards(studentId: string): Promise<ReviewQueueItem[]>;

  // Review submission — does grading, writes ReviewAttempt, updates card.
  submitReview(studentId: string, cardId: string, payload: unknown): Promise<ReviewSubmitResult>;
}
```

## Web UI

### New Files

| File | Responsibility |
|---|---|
| `lib/review.ts` | `fetchReviewQueue()`, `submitReview(cardId, payload)` + types |
| `components/dashboard/ReviewWidget.tsx` | Dashboard widget: due count + Review button |
| `app/review/page.tsx` | Review session page — one card at a time |
| `tests/review.test.ts` | Fetch helper tests |
| `tests/dashboard/ReviewWidget.test.tsx` | Widget state variants |
| `tests/pages/review.test.tsx` | Session flow smoke test |

### Modifications

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Fetch `/api/review/queue`, render `<ReviewWidget dueCount={n} />` above `<StatsCard>` |

### Dashboard Widget

Top slot on the dashboard, above the stats tiles:

```
┌─────────────────────────────────────────────────────────────┐
│  Review Queue                                                │
│  3 cards due                                    [Review →]   │
└─────────────────────────────────────────────────────────────┘
```

**States:**
- **Cards due (≥1):** full widget with count and "Review →" button linking to `/review`.
- **Zero due, cards exist:** collapses to a small muted line — `✓ All caught up — nothing due for review`.
- **No cards at all** (student has never had a struggled quiz pass): widget hidden entirely.
- **Queue fetch failed:** widget hidden (silent degrade; don't block dashboard).

### `/review` Session Flow

1. On mount, fetch `/api/review/queue`. If `due.length === 0` → render completion state: "All caught up — see you when the next card is due" + "Back to dashboard" link.
2. Otherwise render the first card:
   - Header: `Review · card 1 of N` (progress)
   - Exercise prompt via `react-markdown`
   - Exercise body rendered by the existing `FillBlankExercise` / `PredictOutputExercise` / `MultipleChoiceExercise` components from `components/lesson/renderers/`. No new renderers.
3. Student answers → client POSTs to `/api/review/:cardId/submit` with the payload.
4. On response: the renderer already shows its own correct/incorrect feedback (it does so today in lesson mode). Review page overlays the correct answer for a failed card and a "Next →" button.
5. "Next →" advances to card 2 (`card 2 of N`).
6. After the last card: completion state "All done — N reviewed" with links to dashboard and `/tracks`.

**Error handling:**
- Queue fetch fails → `/review` shows an error panel with a "Retry" button.
- Submit fails → inline error; the student stays on the same card, can retry.

### Renderer Reuse

`/review` imports `FillBlankExercise`, `PredictOutputExercise`, and `MultipleChoiceExercise` directly from `components/lesson/renderers/`. The page supplies the exercise payload and handles the submit callback. This mirrors how the lesson page uses the same components — zero renderer duplication.

## Testing Strategy

### Platform (~12-14 tests)

**Unit — `ReviewQueueService`:**
- `handleSubmission` eligibility: struggled pass (`failedAttemptsBefore > 0`) creates card; clean first-try pass skips; hints-used pass creates card; non-quiz exercise type (code, fix_bug, capstone_submission) skips; duplicate card (already exists) is a no-op thanks to the unique constraint.
- Scheduling: initial card has `step = 1, nextDueAt = createdAt + 3d`; step 2 → `+ 7d`; step 4 pass → `retiredAt` set.
- Review pass at step 2 advances to step 3 with correct `nextDueAt`.
- Review fail at step 3 resets to `step = 1, nextDueAt = now + 3d`.
- `getDueCards` returns only cards where `nextDueAt <= now()` AND `retiredAt IS NULL`.
- `getDueCards` excludes cards whose exercise has no currently-published version.
- `getDueCards` orders by `nextDueAt ASC`.

**E2E — `ReviewQueueController`:**
- `GET /api/review/queue` returns 401 without auth.
- `GET /api/review/queue` returns due cards with exercise payload in the response shape.
- `POST /api/review/:cardId/submit` on pass advances the card's step.
- `POST /api/review/:cardId/submit` on fail resets the card to step 1.
- `POST /api/review/:cardId/submit` returns 404 when cardId belongs to another student.
- `POST /api/review/:cardId/submit` returns 409 when the card is already retired.

**Integration — streak:**
- `StreakService.getCurrentStreak` counts a day where the student has only a `ReviewAttempt` and no `Attempt` entries.

### Web (~5 tests)

- `lib/review.ts`: `fetchReviewQueue` on 200 / non-ok; `submitReview` on 200 / non-ok (pass and fail shape).
- `ReviewWidget`: renders empty-state line when `dueCount === 0 && hasAnyCards`; renders full widget when `dueCount > 0`; renders nothing when `hasAnyCards === false`.
- `/review` page: empty-queue completion state renders; advances from card 1 → card 2 after a successful submit (smoke test).

**Estimated total:** ~17-19 new tests.

### Skipped

No Playwright E2E for this spec — unit + controller E2E on the platform side plus component tests on the web side give sufficient coverage. The end-to-end flow heavily reuses the existing lesson-renderer tests.

## Out of Scope

Explicitly NOT in this spec:

- **Struggle detection nudges** — that's Sub-project B2.
- **Daily review caps** — uncapped; student stops whenever.
- **Postpone / skip endpoint** — no "show me tomorrow" button.
- **Code exercises in the queue** — only the three quiz types. Reconsider after B1 ships with data.
- **Per-concept review shortcuts** — no "review all `functions` cards" filter.
- **Opt-out / settings** — no per-student preference to disable reviews.
- **Instructor-facing review analytics** — no new data in the instructor dashboard about student retention performance.
- **Reschedule on new lesson content** — no automatic review burst when a new lesson covers a concept the student has cards for.
- **Review history UI** — student doesn't see past review attempts.
- **Card state surfaced to student** — no "step 2 of 4" shown in UI. Internal state only.
