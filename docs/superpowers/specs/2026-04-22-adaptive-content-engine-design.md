# Spec #11 — Adaptive Content Engine

**Date:** 2026-04-22
**Status:** Design approved
**Depends on:** Specs #1 (content model), #2 (lesson runtime), #4 (auth + cohorts), #5 (submission/grading), #9 (curriculum authoring), #10 (capstone bridge)
**Unblocks:** Spec #12 (Swift curriculum content + Mini Peacock MVP), future Kotlin content spec

## Summary

Turn `Lesson.exercises` from a fixed ordered list into an **exercise pool** that the platform samples from per student, based on cohort configuration and attempt history. Author curriculum once at depth; deliver differently per cohort (4-week vs 3-month). Students can revisit completed lessons and get *unseen* exercises from the pool.

This is a platform-feature spec. It defines the model and runtime semantics. The actual curriculum content targeting the new model is Spec #12.

## Why now

Before authoring ~33+ lessons, we need the model to match the product. Current model assumes a fixed exercise list per lesson, which either over-serves 4-week cohorts or under-serves 3-month cohorts. The same content has to flex to both cohort lengths without forking the curriculum.

Replayability with fresh exercises on revisit also requires pool semantics — without a pool, "revisit" can only show the same exercises the student already did.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pool representation | Semantic change to existing `Lesson.exercises[]` — now an ordered pool | No schema migration for content; authors keep the same structure with expanded contents |
| Cohort-length parameter | `Cohort.cohortLength` enum (`four_week` \| `twelve_week`) + `exercisesPerLessonTarget` Int | Enum gives us extensibility (e.g., `eight_week` later); explicit integer lets us tune without touching code |
| Selection policy | First-N-unseen in author order | Author ordering encodes learning progression; deterministic, debuggable, simple |
| "Seen" definition | Any `Attempt` exists (pass or fail) | Offering the same failed exercise again feels punitive; student can still manually redo via pool-complete state |
| Session stability | New `LessonAssignment` entity pins the displayed set | Without it, passing an exercise mid-lesson makes it disappear on refresh, which is confusing UX |
| Revisit trigger | Explicit `POST /api/lessons/:id/revisit` | Prevents accidental rotation from a sidebar click; student consciously opts into fresh exercises |
| Pool exhaustion | "Pool complete" UI with all exercises listed for manual redo | Encourages deliberate review; no mindless re-shuffle of the same N |
| Lesson-level cohort gating | `Lesson.cohortGate` enum (nullable) | Lets Spec #12 add depth lessons that only 3-month cohorts see, without forking tracks |
| Per-student override | Out of scope | Cohort-level config is enough for MVP; add `Enrollment.contentMode` later if demand surfaces |
| Difficulty ramping | Out of scope | Author ordering is the only signal; explicit difficulty tags can come in a later spec |

## Data model

```prisma
enum CohortLength {
  four_week
  twelve_week
}

model Cohort {
  // ... existing fields ...
  cohortLength              CohortLength
  exercisesPerLessonTarget  Int           // 4 for four_week default, 10 for twelve_week default
}

model Lesson {
  // ... existing fields, including exercises[] ...
  // Semantic change: exercises[] is now the POOL, ordered by intended progression.
  cohortGate  CohortLength?
  // null = core (all cohorts); set = only cohorts with length >= this see this lesson
}

model LessonAssignment {
  id                    String    @id @default(uuid())
  studentId             String    @db.Uuid
  lessonId              String
  lessonVersion         Int
  selectedExerciseIds   String[]
  selectedAt            DateTime  @default(now())
  completedAt           DateTime?

  student  User    @relation(fields: [studentId], references: [id])
  lesson   Lesson  @relation(fields: [lessonId, lessonVersion], references: [id, version])

  @@index([studentId, lessonId])
  @@index([studentId, completedAt])
}
```

**Rules:**
- At most one `LessonAssignment` per `(studentId, lessonId)` with `completedAt = null` at any time (active assignment).
- Multiple completed assignments may exist per `(studentId, lessonId)` — that's the revisit history.
- `selectedExerciseIds` is a snapshot — immune to pool edits after the assignment is created (pool versioning is already covered by `lessonVersion`).

## Selection policy

### First visit (no active assignment)

```
targetCount     = cohort.exercisesPerLessonTarget
poolOrdered     = lesson.exercises  (author order)
seenExerciseIds = { e.id | student has any Attempt on e }
selected        = first `targetCount` from poolOrdered where id NOT IN seenExerciseIds
```

If `|selected| < targetCount`, the lesson is in **pool-complete** state — return all pool exercises with their attempt history and let the student pick what to redo. Do NOT pad with already-seen exercises automatically.

Persist `LessonAssignment { studentId, lessonId, lessonVersion, selectedExerciseIds: selected.map(id), selectedAt: now() }`.

### Subsequent GET within same session

Return the existing active `LessonAssignment` verbatim. The selected set is stable until explicit revisit.

### Revisit (explicit `POST /revisit`)

1. If active assignment exists, set its `completedAt = now()`
2. Run first-visit algorithm — will naturally pick unseen exercises since prior assignment's exercises are now in the seen set
3. Return new assignment

### Capstone-submission lessons (Spec #10)

Pool-of-one. Selection trivially returns the single exercise. No revisit concept needed. API paths still work; nothing to special-case.

### Lesson visibility (`cohortGate`)

When resolving a lesson list for a cohort:
- `cohortGate = null` → visible to all cohorts
- `cohortGate = four_week` → visible to 4-week AND 12-week cohorts
- `cohortGate = twelve_week` → visible only to 12-week cohorts

`four_week` is the minimum length, so `cohortGate = four_week` is effectively the same as null — included for semantic clarity and future cohort lengths.

## API changes

| Method | Route | Change |
|--------|-------|--------|
| `GET` | `/api/lessons/:id` | For authenticated students, resolves the active `LessonAssignment` (creates one if none) and returns only the selected exercises. Authoring/preview callers use `?mode=preview` to get the full pool. |
| `POST` | `/api/lessons/:id/revisit` | **New.** Closes the open assignment (if any), creates a new one. Returns the new assignment including exercises. 409 if the lesson is in pool-complete state (nothing to rotate to). |
| `GET` | `/api/lessons/:id/pool-status` | **New.** Returns `{ poolSize: number, seenCount: number, currentAssignmentIds: string[], poolComplete: boolean }`. Drives the "X of Y seen" UI chip. |
| `GET` | `/api/tracks/:id/lessons` | Apply `cohortGate` filter based on the student's cohort length. Authoring/preview callers use `?mode=preview` to get the unfiltered list. |

### Student lesson response shape

```typescript
type LessonResponse = {
  id: string;
  version: number;
  title: string;
  blocks: Block[];        // explanation + exercise blocks, exercises filtered to assignment
  assignment:
    | { status: 'active'; id: string; selectedExerciseIds: string[]; }
    | { status: 'pool_complete'; allExercises: Exercise[]; attemptHistory: Record<string, AttemptSummary>; };
};
```

Two flavors of response discriminated by `assignment.status`. `active` is the normal "here are N exercises" mode; `pool_complete` returns the full menu of past exercises for manual redo.

## Web UI changes

1. **Sidebar** — completed lessons already stay clickable. Add a small rotating-arrow icon (↻) next to completed lessons that triggers `POST /revisit` with a confirm toast.
2. **Lesson header chip** — "You've seen X of Y" (pool-status). Clicking the chip opens a popover showing the full pool with seen/unseen markers.
3. **Pool-complete state** — when the lesson response has `poolStatus: 'pool_complete'`, render a list view instead of the standard block list: each exercise with its best attempt's pass/fail badge, clickable to re-enter.
4. **Cohort indicator** — small badge in the top bar showing cohort length (e.g., "4-week cohort" / "12-week cohort") so students understand why they see N exercises.
5. **"Fresh exercises" button** — on a completed lesson's top bar, a button that calls `POST /revisit` and reloads the lesson view.

No new pages. All changes slot into existing lesson-runtime components from Spec #2.

## Authoring impact (feeds into Spec #9 + Spec #12)

Authors now:

1. **Write 8–12 exercises per lesson** (floor = 4, ceiling soft-capped at 15). Order matters — easy/introductory first, harder/edge cases later.
2. **Tag depth lessons with `cohortGate: twelve_week`** — these only appear for 3-month cohorts. Core lessons omit the tag.
3. **Milestones stay single-exercise** — capstone-submission lessons don't need pools.

Compiler (Spec #9) gains two validations at publish time:
- Lesson pool size ≥ 4 (unless the lesson's only exercise is `capstone_submission`)
- `cohortGate` is a valid `CohortLength` value if present

## Migration

- Two existing stub lessons (`swift-fundamentals/01-intro.md`, `02-functions.md`) keep working — treated as pool-of-3, no cohort gate. They'll be expanded during Spec #12 authoring.
- No existing cohorts in production, so no data migration beyond adding `cohortLength` defaults via Prisma migration (default `four_week`, `exercisesPerLessonTarget = 4`).
- No existing `LessonAssignment` rows to create — the first GET for each (student, lesson) bootstraps the assignment lazily.
- Pool-size validation applies only at publish time for newly compiled lessons; existing published lessons are grandfathered.

## Testing strategy

### Backend (~18–22 new tests)

**Selection policy:**
- First visit creates `LessonAssignment` with first N unseen from pool
- Repeated GET returns same assignment (no rotation without revisit)
- Revisit closes active assignment, creates new one with next N unseen
- Pool-complete state when |unseen| < target count
- Capstone-submission lesson returns single exercise regardless of target count

**Cohort gating:**
- 4-week cohort sees only lessons with `cohortGate` null or `four_week`
- 12-week cohort sees lessons with any `cohortGate` value
- Preview mode bypasses cohort filtering

**Session stability:**
- Passing an exercise mid-lesson doesn't drop it from the active assignment
- Starting a new lesson creates exactly one active assignment per (student, lesson)

**Endpoint behaviors:**
- `POST /revisit` returns 409 when already in pool-complete state
- `GET /pool-status` returns correct counts after attempts
- Preview mode on lesson endpoint returns full pool, no assignment

**Compiler validations:**
- Pool size < 4 fails compile (except capstone)
- Invalid `cohortGate` value fails compile

### Web (~6–8 new tests)

- Lesson renders only the assigned exercises, not the full pool
- Pool-status chip reflects current seen count
- Pool-complete view shows all exercises with their attempt badges
- "Fresh exercises" button calls `POST /revisit` and reloads
- Sidebar revisit icon triggers the same flow

## Out of scope (deferred)

- Per-student content override (`Enrollment.contentMode`) — add when variants within a cohort are requested
- Difficulty tagging and difficulty-ramped selection
- Adaptive-to-performance selection (student aces → harder; struggles → easier)
- Spaced-repetition review recommendations
- Cohort lengths other than 4-week and 12-week
- Analytics on pool consumption rates
- Instructor-facing visibility into which pool exercises each student has seen (useful later for live review sessions)
