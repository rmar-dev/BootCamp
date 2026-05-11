# Adaptive Next-Lesson Recommendation — Design Spec

**Date:** 2026-04-23
**Initiative:** "Improve BootCamp" — sub-project D (adaptive difficulty)
**Status:** Design
**Depends on:** sub-project A (progress & mastery, shipped) and sub-project B1 (SRS review queue, shipped) on `master`.
**Supersedes:** nothing.

## 1. Goals & scope

### 1.1 Goal

On the student dashboard, surface a single, actionable "do this next" recommendation that reduces the decision cost of figuring out which lesson to open. The recommendation is driven by the student's concept mastery (from A) and lesson-level state, and it is always deterministic given the same inputs.

### 1.2 Scope — in

- Backend aggregation inside the existing `ProgressModule`.
- One new HTTP endpoint: `GET /api/progress/recommendation`.
- One new web component on the dashboard: `NextLessonWidget`.
- Unit + e2e coverage on platform; component coverage on web.

### 1.3 Scope — out

See §7 for the full list. The highlights: no within-lesson adaptation, no lesson-skipping, no additional surfaces (tracks list, post-lesson, nav), no caching, no scored ranking, no telemetry.

### 1.4 Clarifying decisions already made

| Question | Decision |
|---|---|
| Scope of "adaptive difficulty" | Smarter next-lesson recommendation (not within-lesson, not skip-ahead). |
| Surface | Dashboard panel only. |
| Optimization signal | Continuation first, concept-gap as tiebreaker. |
| Eligible pool when no continuation | All published lessons across all tracks. |
| Algorithm shape | Deterministic tier waterfall, not scored ranking. |

## 2. API

### 2.1 Endpoint

```
GET /api/progress/recommendation
Auth: JwtAuthGuard (cookie)
```

Lives in `platform/src/progress/progress.controller.ts` alongside the existing `GET /api/progress/concepts` and `GET /api/progress/tracks/:id` routes. No new module; `ProgressModule` grows one method and one route.

### 2.2 Response

Discriminated union keyed on `kind`:

```typescript
type RecommendationResponse =
  | { kind: 'continue';     lesson: LessonSummary; reason: { message: string }; }
  | { kind: 'concept_gap';  lesson: LessonSummary;
      reason: { message: string; concept: string; passed: number; total: number }; }
  | { kind: 'first_timer';  lesson: LessonSummary; reason: { message: string }; }
  | { kind: 'exhausted';                          reason: { message: string }; };

type LessonSummary = {
  id: string;
  version: number;
  title: string;
  trackId: string;
  trackTitle: string;
};
```

The `exhausted` variant has no `lesson` field — there is nothing to link to.

### 2.3 Error responses

- `401` — unauthenticated (standard `JwtAuthGuard` behavior).
- No 404 for missing `Student` row. Matches how `getConceptProgress()` and `getTrackProgress()` already behave: the controller resolves `studentId = student?.id ?? null`, passes it through, and the service treats null as "zero activity" (no passed exercises, no attempts). A user with no `Student` row therefore gets either `first_timer` ("Start here.") or `exhausted` ("No curriculum published yet.") naturally from the waterfall.

### 2.4 What the response does not include

Concept-mastery details (other than the single weakest-concept numbers embedded in the `concept_gap` reason). The dashboard already fetches `/api/progress/concepts` in parallel; duplicating that payload inside the recommendation response wastes bytes and creates two sources of truth.

## 3. Algorithm — tier waterfall

The algorithm walks four tiers in order. The first tier to produce a lesson wins; later tiers are never consulted. Every tiebreaker is deterministic, so identical inputs produce identical outputs.

### 3.1 Tier 1 — in-progress continuation

```
inProgressLessons = lessons across all tracks where state = 'in_progress'
if non-empty:
  pick max(lastAttemptAt)
  tiebreak on ties: track publishedAt ASC → trackId ASC → lesson position ASC
  return { kind: 'continue', lesson, reason: 'Continue where you left off.' }
```

Lesson state follows A's rules: `in_progress` means `attemptedExercises > 0` and `passedExercises < totalExercises`.

### 3.2 Tier 2 — weakest-concept gap

```
conceptsWithGap = concepts where total > 0 AND passed < total
if empty: fall through to Tier 3

sort concepts weakest-first:
  1. ascending passed / total ratio
  2. tiebreak: descending (total - passed)
  3. tiebreak: ascending concept name

for each concept in that order:
  eligibleLessons = lessons with state in ('not_started','in_progress')
                    AND lesson's concept set includes this concept
  if non-empty:
    pick first in catalog order (track publishedAt ASC → trackId ASC → lesson position ASC)
    return { kind: 'concept_gap', lesson,
             reason: { concept, passed, total,
                       message: `Practice <concept> — you've passed <passed>/<total> so far.` } }
             # when passed == 0: `Start on <concept> — 0/<total> passed.`
```

A lesson's concept set is the union of concepts across every exercise in that lesson's published blocks (latest published exercise version per exercise id).

### 3.3 Tier 3 — first-timer / no-gap fallback

```
candidates = lessons with state in ('not_started','in_progress')
if empty: fall through to Tier 4

pick first in catalog order (track publishedAt ASC → trackId ASC → lesson position ASC)

if student has zero exercise attempts overall:
  reason = 'Start here.'
else:
  reason = `Next up: <track title>.`

return { kind: 'first_timer', lesson, reason }
```

Tier 3 handles two populations with one branch: brand-new students (all concepts at 0/0) and seasoned students who have closed every gap but still have untouched lessons (new content published since they last caught up).

### 3.4 Tier 4 — exhausted

```
if no tracks published at all:
  return { kind: 'exhausted', reason: 'No curriculum published yet.' }
return { kind: 'exhausted', reason: "You've finished the published curriculum." }
```

## 4. Aggregation & query plan

Matches A's pattern: compute on every request, no caching, bulk queries whose count is independent of catalog size.

### 4.1 Queries (seven, fixed count)

1. `StudentRepository.findByUserId(userId)` — resolve to `studentId | null`; null is OK (zero-activity path).
2. `prisma.track.findMany({ where: { publishedAt: { not: null } }, orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }], select: { id, title, lessonIds, lessonVersions, publishedAt } })` — collect published tracks. `lessonIds` / `lessonVersions` are inline arrays on the `Track` row (matching the existing `findLatestPublished` pattern).
3. `prisma.lesson.findMany({ where: { OR: [{ id, version }, ...] }, select: { id, version, title, trackId, position } })` — load lesson titles, positions, and track ids for the summary payload.
4. `prisma.block.findMany({ where: { OR: lessonKeys.map(k => ({ lessonId: k.id, lessonVersion: k.version })) }, select: { lessonId, lessonVersion, kind, exerciseId } })` — get exercise refs per lesson (compound key required; blocks are versioned per lesson version).
5. `prisma.exercise.findMany({ where: { id: { in: [...] }, publishedAt: { not: null } }, select: { id, version, concepts } })` — filter to latest published version per id in memory.
6. `studentId ? prisma.exerciseResult.findMany({ where: { studentId, passed: true, exerciseId: { in: [...] } }, select: { exerciseId } }) : []` — passed exercises for this student (skip query entirely when null).
7. `studentId ? prisma.attempt.groupBy({ by: ['exerciseId'], where: { studentId, exerciseId: { in: [...] } }, _max: { submittedAt: true } }) : []` — most-recent attempt per exercise (drives `lastAttemptAt` per lesson).

### 4.2 In-memory roll-up (single pass)

`lessonKey` is the string `"${id}:${version}"` so the maps key by the specific published lesson version.

- `perLessonState: Map<lessonKey, { state, lastAttemptAt }>` — A's existing logic, reused.
- `conceptCounts: Map<concept, { passed, total }>` — A's existing logic, reused.
- `lessonConcepts: Map<lessonKey, Set<concept>>` — **new** for this feature; union of concepts across the lesson's published exercise versions.

Then evaluate the §3 waterfall against those three maps.

### 4.3 Reuse policy

Do not refactor A's `getConcepts()` / `getTrackProgress()`. Add a private helper method on `ProgressAggregatorService` (e.g., `aggregateForRecommendation(student)`) that loads the data and builds the three maps. Expect ~20 lines of duplication with A's helpers — acceptable cost to keep each public method readable in isolation. No new repositories; use `PrismaService` directly, matching A.

### 4.4 Performance

Seven queries per dashboard load, independent of catalog size. A's aggregation uses the same shape in production today; this adds one more map computation over the same row set. If the catalog grows past ~500 lessons and p95 latency degrades, revisit as its own perf ticket — do not pre-optimize.

## 5. Web UI

### 5.1 Component

`web/components/dashboard/NextLessonWidget.tsx` — prop-driven, mirrors `ReviewWidget`.

```typescript
type Props = { recommendation: RecommendationResponse | null };

export function NextLessonWidget({ recommendation }: Props) {
  if (!recommendation) return null;          // fetch failed → silent degrade
  switch (recommendation.kind) { /* variants */ }
}
```

### 5.2 Fetch helper

Extend `web/lib/progress.ts` with:

```typescript
export async function fetchRecommendation(): Promise<RecommendationResponse> {
  const res = await fetch(`${BASE}/api/progress/recommendation`, { credentials: 'include' });
  if (!res.ok) throw new Error(`recommendation ${res.status}`);
  return res.json();
}
```

Co-located with `fetchConceptProgress` so all progress-module calls live in one file. The shared `RecommendationResponse` / `LessonSummary` types are declared here too.

### 5.3 Dashboard wiring

`app/dashboard/page.tsx` adds one parallel call and one state slot:

```typescript
Promise.all([
  fetchDashboard(),
  fetchLeaderboard(),
  fetchConceptProgress().catch(() => null),
  fetchReviewQueue().catch(() => null),
  fetchRecommendation().catch(() => null),   // NEW
])
```

Placement in the render tree (between `ReviewWidget` and `StatsCard`):

```
<ReviewWidget ... />         ← retention first (time-sensitive)
<NextLessonWidget ... />     ← NEW: forward progress
<StatsCard ... />
<ConceptMastery ... />
<BadgesGrid ... />
<LeaderboardTable ... />
```

Rationale: SRS due cards are time-decaying, so they outrank forward progress. On brand-new accounts, `ReviewWidget` returns null (no cards yet) so `NextLessonWidget` naturally becomes the top action — the "Start here." case. On caught-up accounts the review widget shrinks to a one-line muted "✓ All caught up", and the next-lesson widget dominates visually.

### 5.4 Per-`kind` visual treatment

Single shell, one `switch` internally. Shell matches `ReviewWidget`: rounded border, `bg-white dark:bg-gray-900`, uppercase-tracking eyebrow, body, right-aligned CTA as Next.js `<Link>`.

| `kind`        | Eyebrow                                              | Body                                                                         | CTA          | Link                  |
|---------------|------------------------------------------------------|------------------------------------------------------------------------------|--------------|-----------------------|
| `continue`    | `Continue`                                           | lesson.title · muted trackTitle · reason.message                             | `Resume →`   | `/lesson/<lesson.id>` |
| `concept_gap` | `Practice <concept>` (or `Start <concept>` when `reason.passed == 0`) + tabular `passed/total` chip | lesson.title · muted trackTitle · reason.message | `Practice →` (or `Start →` when `reason.passed == 0`) | `/lesson/<lesson.id>` |
| `first_timer` | `Start here` if reason.message starts with `"Start"`, else `Next up` | lesson.title · muted trackTitle · reason.message         | `Start →`    | `/lesson/<lesson.id>` |
| `exhausted`   | `All done`                                           | reason.message only, centered, muted styling                                 | *(none)*     | *(none)*              |

Details:
- CTA color is the same blue as `ReviewWidget` across all kinds. Not color-coding per kind keeps visual noise low; the eyebrow carries the semantic difference.
- The `first_timer` eyebrow split is a pure-frontend choice driven by the leading word of `reason.message`. No extra API field needed.
- Lesson title and track title use `truncate` to prevent overflow.
- `exhausted` uses neutral `text-gray-500` — it is an end state, not a call to action.

### 5.5 Edge cases

- `recommendation === null` (fetch threw) → render nothing, matching `ConceptMastery` and `ReviewWidget`.
- Concept names with spaces / special chars render as plain text inside the eyebrow.
- Student clicks CTA, finishes the lesson, returns to dashboard → stale payload in React state until refresh. Acceptable for v1; see §7 deferred list.

## 6. Testing strategy

### 6.1 Platform — service spec

`platform/test/progress/recommendation.service.spec.ts` (new). Harness matches the existing `progress.service.spec.ts`: real Postgres via `makeTestPrisma` + `resetDb`, direct repository construction, shared `makeExercise` / `makeLessonWithExercises` helpers copied from that spec (small duplication, keeps each file under one responsibility).

One `describe` block per tier:

**Tier 1 — continuation**
- Single in-progress lesson → `continue` with that lesson.
- Multiple in-progress across tracks → picks max `lastAttemptAt`.
- Same-millisecond ties → earlier-published track wins; within track, lower `position` wins.
- Completed lessons never beat in-progress, even with newer timestamps.

**Tier 2 — concept gap**
- No in-progress + one concept with gap → `concept_gap` for that concept.
- Two concepts, different `passed/total` → lower ratio wins.
- Equal ratios → higher `(total - passed)` wins; then alphabetical concept name.
- Weakest concept has zero eligible lessons (all complete) → falls through to next concept.
- `passed == 0` case → reason message uses `"Start on X — 0/N passed."`.

**Tier 3 — first-timer / no-gap**
- Brand-new student, nothing attempted → `first_timer` with `"Start here."`, first lesson in catalog order.
- Returning student, all concepts at 100%, unstarted lessons remain → `first_timer` with `"Next up: <track>."`.

**Tier 4 — exhausted**
- All lessons complete → `exhausted` with "finished the published curriculum".
- No tracks published at all → `exhausted` with "No curriculum published yet."

**Edge cases**
- Draft track (`publishedAt IS NULL`) excluded from all tiers.
- Draft lesson version excluded; only latest published lesson version considered.
- Exercise version bump invalidates prior pass (student passed v1, v2 published, v2 unattempted → lesson counts as in-progress; asserts consistency with A).
- Missing `Student` row → service invoked with `studentId = null` → returns `first_timer` ("Start here.") when tracks are published, or `exhausted` ("No curriculum published yet.") when none are. Matches `getConceptProgress` / `getTrackProgress` null-student handling.

### 6.2 Platform — controller e2e

`platform/test/progress/recommendation.controller.spec.ts` (new). Same harness as `progress.controller.spec.ts`: `AppModule`, supertest, `DockerRunner` stub, cookie-auth helper. Minimal cases — logic coverage lives in the service spec.

- `GET /api/progress/recommendation` unauthenticated → 401.
- Authenticated + no `Student` row + published lesson exists → 200, `{ kind: 'first_timer', ..., reason: { message: 'Start here.' } }`.
- Authenticated + one in-progress lesson → 200, body matches `{ kind: 'continue', lesson: { id, version, title, trackId, trackTitle }, reason: { message } }`.
- Authenticated + empty catalog → 200, `{ kind: 'exhausted', reason: { message: 'No curriculum published yet.' } }`.

### 6.3 Web — component spec

`web/tests/dashboard/NextLessonWidget.test.tsx` (new). Vitest + `@testing-library/react`, modeled on `ReviewWidget.test.tsx`. Pure presentation tests, no fetch mocking.

- `recommendation === null` → renders nothing.
- `continue` → eyebrow `Continue`, lesson + track titles visible, CTA `Resume →` links to `/lesson/<id>`.
- `concept_gap` → eyebrow contains concept and `2/5`, CTA `Practice →`, links to `/lesson/<id>`.
- `first_timer` with `"Start here."` reason → eyebrow `Start here`, CTA `Start →`.
- `first_timer` with `"Next up: …"` reason → eyebrow `Next up`, CTA `Start →`.
- `exhausted` → eyebrow `All done`, reason message visible, no link rendered.

### 6.4 Web — what is not tested

- `lib/progress.ts::fetchRecommendation` — matches the existing project convention (`lib/progress.ts` has no test file even though `lib/review.ts` does). The helper is three lines of fetch glue; it is exercised transitively in QA.
- Dashboard page integration — no test file exists for `app/dashboard/page.tsx` and A/B1 shipped without adding one. Not adding one now.

### 6.5 Run commands

- Platform: `npm --prefix platform test -- recommendation`.
- Web: `npm --prefix web test -- NextLessonWidget`.
- Full pre-merge: `dev.ps1 test`.

## 7. Out of scope & deferred

### 7.1 Out of scope (decided — not revisiting in this spec)

- **Within-lesson difficulty adaptation** — exercise-level branching, hint escalation, per-exercise difficulty. Clarifying Q #1 selected lesson-level recommendation over within-lesson flow.
- **Lesson-skipping / placement diagnostics** — students traverse lessons in catalog order; mastery-based skip-ahead is a separate initiative.
- **Additional surfaces** — tracks list, post-lesson "up next", nav "Smart Start". Clarifying Q #2 scoped to dashboard only.
- **Scored ranking (Approach B)** — rejected. Weights are arbitrary without data, and score-based explanations hurt UX.
- **Caching / pre-computation** — compute per request, matching A.
- **Concept-mastery map inside the recommendation response** — dashboard fetches `/api/progress/concepts` in parallel already.
- **`Lesson.level` filtering** — the existing `level` field (beginner/intermediate/advanced) is ignored here.
- **Pace / time-of-day / streak personalization** — deterministic from concept mastery + lesson state only.
- **Review-queue interaction** — the engine does not read the SRS queue, does not suppress lessons with due cards, does not prefer lessons that improve review coverage. Dashboard layout is the only coupling.
- **Instructor-facing variant** — different user, different feature.
- **Cohort / `LessonAssignment` awareness** — all published lessons are eligible regardless of the student's cohort. Revisit when cohort-based assignment is a real production constraint.

### 7.2 Deferred (plausible follow-ups)

- **Telemetry** — log served `kind` + whether CTA was clicked, so a future Approach-B weighting has real data.
- **Client-side re-fetch after lesson completion** — currently the student must refresh to get a new recommendation. Acceptable for v1.
- **Explanation drilldown** — "why this concept" or "next 2–3 candidates". `reason.message` is the entire surface.

### 7.3 Non-interaction with spec #11 (adaptive-content-engine)

Spec #11 adapts *which exercises* a student sees within a given lesson via cohort pools. This spec (#D) picks *which lesson* to recommend. They compose cleanly: D points at a lesson, #11 populates that lesson's exercises. No design coupling.

### 7.4 Explicit non-changes to shipped code

- No refactor of A's `getConcepts()` / `getTrackProgress()`.
- No schema migrations. `Student`, `Track`, `Lesson`, `Exercise`, `Block`, `Attempt`, `ExerciseResult` untouched.
- No new repositories. `PrismaService` is used directly inside `ProgressAggregatorService`, matching A.
