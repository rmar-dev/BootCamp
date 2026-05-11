# Progress & Mastery (Sub-project A)

**Date:** 2026-04-23
**Status:** Design approved
**Depends on:** Specs #1 (content model), #5 (submission + grading), #6 (gamification)
**Part of:** "Improve BootCamp" initiative (7 improvements decomposed into 4 sub-projects — this is A of 4)

## Summary

Add progress tracking to the platform. Surface lesson completion state on the track detail timeline, a "continue where you left off" prompt on the tracks list, and a concept-mastery panel on the dashboard. All data is derived on request from existing `ExerciseResult` + `Attempt` tables — no schema changes.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lesson completion rule | Three states: not_started, in_progress, complete (D) | Matches what Brilliant/Boot.dev/Codecademy do; "in_progress" is meaningfully distinct from either end |
| Concept mastery rule | Percentage with fraction display (C) | No arbitrary thresholds; students see real progress per concept |
| Where progress surfaces | Track detail + tracks list + dashboard (C) | The three places students naturally look |
| Caching strategy | Compute on every request (A) | Queries bounded by student data; indexes already in place; YAGNI for cache |
| Module architecture | New `ProgressModule` (A) | Clean domain boundary; mirrors how InstructorReview got its own module |

## Decomposition Context

The "improve BootCamp" initiative has 4 sub-projects:

- **A (this spec):** Progress & mastery — lesson completion state, concept progress
- **B:** Retention loop — spaced repetition review queue, struggle detection nudges
- **C:** Community learning — per-exercise discussion, peer review
- **D:** Adaptive difficulty — next-lesson recommendation based on mastery

Order: A → B → D → C. This spec covers A only. Sub-project D will depend on this spec's concept-mastery data.

## Data Model

**No schema changes.** All data comes from existing tables:

| Source | Field | Use |
|--------|-------|-----|
| `ExerciseResult` | `studentId`, `exerciseId`, `passed`, `firstPassedAt` | Has the student passed this exercise? |
| `Attempt` | `studentId`, `exerciseId`, `submittedAt` | Attempt counts, most recent activity |
| `Exercise` | `concepts: string[]` | Concept tagging per exercise |
| `Block` | `lessonId`, `lessonVersion`, `exerciseId` | Map lessons to their exercises |
| `Track` | `lessonIds[]`, `lessonVersions[]` | Map tracks to their lessons |

## API Endpoints

Both authenticated (`JwtAuthGuard`). Routes under `/api/progress`.

### `GET /api/progress/tracks/:trackId`

Returns per-lesson completion state for the calling student on one track.

```typescript
type TrackProgressResponse = {
  trackId: string;
  lessons: Array<{
    lessonId: string;
    lessonVersion: number;
    totalExercises: number;
    passedExercises: number;
    attemptedExercises: number;
    state: 'not_started' | 'in_progress' | 'complete';
    lastAttemptAt: string | null;  // ISO date
  }>;
};
```

**State derivation:**
- `not_started` — `attemptedExercises === 0`
- `complete` — `passedExercises === totalExercises && totalExercises > 0`
- `in_progress` — otherwise

**404 if** the track doesn't exist. **Empty lessons array** is valid (track published with no lessons yet).

### `GET /api/progress/concepts`

Returns concept-mastery aggregation across all published exercises for the calling student.

```typescript
type ConceptsResponse = {
  concepts: Array<{
    concept: string;
    totalExercises: number;   // total published exercises tagged with this concept
    passedExercises: number;  // how many the student has passed
  }>;
};
```

Sorted by `passedExercises DESC, concept ASC`. Includes concepts the student hasn't touched yet (`passedExercises: 0`) so they see what's available.

## Aggregation Strategy

Both endpoints compute fresh on every request using bulk queries (no N+1):

### Track progress query plan

1. Load track: `TrackRepository.findLatestPublished(trackId)` — 1 query
2. Load all lessons by composite key via `Lesson.findMany({ where: { OR: [{id, version}, ...] } })` — 1 query
3. Load all blocks for these lessons: `Block.findMany({ where: { lessonId: { in: [...] } } })` — 1 query
4. Collect all exercise IDs from blocks, then:
   - `ExerciseResult.findMany({ where: { studentId, exerciseId: { in: [...] } } })` — 1 query
   - `Attempt.groupBy({ by: ['exerciseId'], where: { studentId, exerciseId: { in: [...] } }, _count: true, _max: { submittedAt: true } })` — 1 query
5. Roll up in memory — per lesson, count exercises that have a passed ExerciseResult, count exercises with any attempt, find max submittedAt.

**Total: 5 queries regardless of lesson or exercise count.**

### Concept progress query plan

1. Resolve student from userId: `StudentRepository.findByUserId(userId)` — 1 query
2. Load all published exercises with concepts: `Exercise.findMany({ where: { publishedAt: { not: null } }, select: { id: true, concepts: true } })` — 1 query. Filter to latest version per id in memory (same pattern as Track listing).
3. Load student's passed ExerciseResults: `ExerciseResult.findMany({ where: { studentId, passed: true }, select: { exerciseId: true } })` — 1 query
4. Flatten concepts → count total + passed per concept in memory

**Total: 3 queries.**

## Web App — 3 Touchpoints

### Track detail `/tracks/[id]` — Timeline state markers

The existing numbered-circle timeline gets a state indicator:

| State | Visual |
|-------|--------|
| `not_started` | Empty bordered circle with the lesson number (current look) |
| `in_progress` | Lesson number with a half-filled ring (partial arc around the circle) |
| `complete` | Solid green circle with ✓ (number hidden) |

Progress is fetched in parallel with the track data:
```typescript
const [track, progress] = await Promise.all([fetchTrack(id), fetchTrackProgress(id).catch(() => null)]);
```

If progress fetch fails (e.g. DB hiccup), degrade gracefully: all lessons render as `not_started`.

**Smart "Start learning" button** on the header card becomes context-aware:
- Any lesson is `in_progress` → label **"Continue"**, link to that lesson (pick the one with the most recent `lastAttemptAt`)
- All lessons `complete` → label **"Review"**, link to lesson 1
- Otherwise → label stays **"Start learning"**, link to lesson 1

### Tracks list `/tracks` — "Continue where you left off" row

Above the existing track grid, add a one-line prompt only when the student has any in-progress track:

```
Continue learning
→  Swift Fundamentals · Intro to Swift                 [Continue →]
```

Implementation:
1. On page load, fetch the list of tracks as today.
2. In parallel, fetch progress for each track (`Promise.all` over `fetchTrackProgress(id)`).
3. Pick the track with the highest `lastAttemptAt` across any lesson in any track.
4. If the winning track has a lesson with state `in_progress`, render the row linking to that lesson. Otherwise skip.

Hidden when no progress exists — first-time student doesn't see it.

### Dashboard `/dashboard` — Concept Mastery panel

New panel rendered below the stats tiles, above the BadgesGrid:

```
┌─ Concepts ─────────────────────────────────────────────────────┐
│  functions        ████████░░  8 / 10                           │
│  strings          ██████████ 10 / 10  ✓                        │
│  arithmetic       ████░░░░░░  4 / 10                           │
│  conditionals     ░░░░░░░░░░  0 / 3                            │
└────────────────────────────────────────────────────────────────┘
```

Styling follows the existing muted, GitHub-inspired aesthetic:
- Thin 1.5px progress bar, gray background, green fill
- ✓ to the right of the fraction when `passedExercises === totalExercises`
- Concept label is gray when `passedExercises === 0` (not yet touched)
- Rows alphabetical after the sort-by-passed-DESC server ordering (server handles sort)

## File Structure

### Platform (new)

| File | Responsibility |
|------|---------------|
| `src/progress/progress.module.ts` | Module registration |
| `src/progress/progress.controller.ts` | Two routes |
| `src/progress/progress.service.ts` | Aggregation logic |
| `src/app.module.ts` | Register ProgressModule (modify) |
| `test/progress/progress.controller.spec.ts` | E2E tests |

No new repositories — the service queries via `PrismaService` directly for the bulk aggregations. Single-record lookups that already exist (TrackRepository, StudentRepository) are reused.

### Web (new + modified)

| File | Responsibility |
|------|---------------|
| `lib/progress.ts` | Fetch helpers + types |
| `components/dashboard/ConceptMastery.tsx` | New concept progress panel |
| `components/tracks/TimelineLessonNode.tsx` | Extract state-aware lesson node (was inline in track detail page) |
| `app/tracks/[id]/page.tsx` | Wire progress, smart button (modify) |
| `app/tracks/page.tsx` | Add "Continue learning" row (modify) |
| `app/dashboard/page.tsx` | Add ConceptMastery panel (modify) |
| `tests/progress.test.ts` | Fetch helper tests |
| `tests/dashboard/ConceptMastery.test.tsx` | Component tests |
| `tests/tracks/timeline.test.tsx` | Timeline state variants |

## Testing Strategy

### Platform (~8-10 tests)

**Unit — ProgressService:**
- Track progress rolls up correctly: 3 exercises, 2 passed → `in_progress`; 0 attempted → `not_started`; 3 passed → `complete`
- `lastAttemptAt` reflects the max `submittedAt` across the lesson's exercises
- Concept progress: exercise tagged `['functions', 'strings']` contributes to both concept counts
- Edge cases: track with no lessons, lesson with no exercises, student with no attempts

**Integration — ProgressController E2E:**
- `GET /api/progress/tracks/:id` returns 401 without auth
- `GET /api/progress/tracks/:id` returns correct states for a seeded student with mixed progress
- `GET /api/progress/tracks/:id` returns 404 for non-existent track
- `GET /api/progress/concepts` returns 401 without auth
- `GET /api/progress/concepts` returns counts across multiple tracks
- Zero-activity student: all lessons `not_started`, all concepts `0 / N`

### Web (~4-5 tests)

- Timeline renders three state variants (not_started, in_progress, complete)
- Smart button: shows "Continue" / "Review" / "Start learning" based on progress shape
- Tracks list "Continue" row: appears only when in-progress tracks exist; picks most-recent
- ConceptMastery: renders bars with correct percentages, shows ✓ on fully-complete

### Estimated total: ~13-15 new tests.

## Out of Scope

- Caching / pre-computation (can be added later if queries become slow).
- Per-exercise progress views (only lesson-level rollup).
- Historical progress timelines (charting over time) — that's a separate analytics feature.
- Progress export / certificates — belongs to a future credentialing spec.
- Recommending the *next* lesson based on concept mastery — that's Sub-project D.
- Spaced-repetition review queue — that's Sub-project B.
