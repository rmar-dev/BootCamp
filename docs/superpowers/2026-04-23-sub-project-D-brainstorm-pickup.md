# Sub-project D (Adaptive Difficulty) — Brainstorm Pickup

**Date paused:** 2026-04-23
**Status:** Mid-brainstorming. Sections 1–3 approved by user. Sections 4–6 not yet presented. Spec not written yet.

## Context

"Improve BootCamp" initiative, sub-project D — next-lesson recommendation driven by concept mastery from sub-project A. A and B1 are already merged to master. Chose D over B2 for higher leverage (per Brilliant/Boot.dev research).

**Important branch note:** Both `platform/` and `web/` checkouts are on `feat/adaptive-content-engine` (spec #11 user work — leave alone). Master has A + B1 shipped. Design D against master's model, not the current branch state.

- Platform master @ `1ac451f` (progress module + review-queue + A+B1 features)
- Web master @ `11525d2` (progress UI + ReviewWidget)
- Abandoned stash on platform (`stash@{0}`) — leave alone

## Related specs on disk

- `docs/superpowers/specs/2026-04-23-progress-and-mastery-design.md` — sub-project A (D depends on this)
- `docs/superpowers/specs/2026-04-23-retention-srs-design.md` — sub-project B1
- `docs/superpowers/specs/2026-04-22-adaptive-content-engine-design.md` — spec #11 (unrelated to D despite the name — it's about cohort-based exercise pools, not adaptive difficulty)

## Clarifying questions — answered

| Question | Answer |
|----|----|
| Scope of "adaptive difficulty" | **Smarter next-lesson recommendation** (not within-lesson adaptation, not lesson-skipping, not combined) |
| Surface | **Dashboard panel only** (not tracks-list, not post-lesson, not Smart Start button) |
| Optimization signal | **Continuation first, concept-gap as tiebreaker** |
| Eligible lesson pool when no continuation | **All published lessons across all tracks** |

## Approach chosen — A (deterministic waterfall)

Rejected Approach B (scored ranking) — weights are arbitrary without data, and score-based explanations hurt UX.

```
Tier 1 — In-progress continuation (max lastAttemptAt)
Tier 2 — Weakest-concept gap (iterate concepts weakest-first, pick first eligible lesson)
Tier 3 — First-timer / no-gap fallback (first not-complete lesson in catalog order)
Tier 4 — Exhausted
```

## Section 1 — Module & API shape — APPROVED

- Extends existing `ProgressModule` (shipped in A). No new module.
- New method on `ProgressService`, new controller route.
- `GET /api/progress/recommendation` (JwtAuthGuard).
- Response: discriminated union by `kind`:

```typescript
type RecommendationResponse =
  | { kind: 'continue'; lesson: LessonSummary; reason: { message: string }; }
  | { kind: 'concept_gap'; lesson: LessonSummary;
      reason: { message: string; concept: string; passed: number; total: number }; }
  | { kind: 'first_timer'; lesson: LessonSummary; reason: { message: string }; }
  | { kind: 'exhausted'; reason: { message: string }; };

type LessonSummary = { id: string; version: number; title: string;
                       trackId: string; trackTitle: string; };
```

Concept-mastery map is NOT included — dashboard already fetches `/api/progress/concepts` in parallel; don't duplicate.

## Section 2 — Algorithm — APPROVED

### Tier 1 — In-progress continuation

```
inProgressLessons = lessons across all tracks where state = 'in_progress'
if non-empty:
  pick max(lastAttemptAt), tiebreak by (track creation order, lesson index)
  return { kind: 'continue', lesson, reason: 'Continue where you left off.' }
```

### Tier 2 — Weakest-concept gap

```
conceptsWithGap = concepts where total > 0 AND passed < total
if empty → fall through

sort concepts weakest-first:
  1. ascending passed/total
  2. tiebreak: descending (total - passed)
  3. tiebreak: ascending concept name

for each concept in that order:
  eligibleLessons = lessons with state in ('not_started','in_progress')
                    AND lesson's concept set includes this concept
  if non-empty:
    pick first in catalog order (track publishedAt ASC → trackId ASC → lesson index ASC)
    return { kind: 'concept_gap', lesson, reason: { concept, passed, total,
             message: `Practice <concept> — you've passed <passed>/<total> so far.` } }
             # if passed = 0: `Start on <concept> — 0/<total> passed.`
```

Lesson's concept set = union of concepts across every exercise in that lesson's published blocks.

### Tier 3 — First-timer / no-gap fallback

```
candidates = lessons with state in ('not_started','in_progress')
if empty → Tier 4
pick first in catalog order
if student has zero attempts → reason: 'Start here.'
else                         → reason: `Next up: <track title>.`
both return { kind: 'first_timer', lesson, reason }
```

### Tier 4 — Exhausted

```
{ kind: 'exhausted', reason: "You've finished the published curriculum." }
# "No curriculum published yet." when no tracks published at all
```

Every tiebreaker deterministic. Same inputs → same output.

## Section 3 — Aggregation — APPROVED

Match A's pattern: compute on every request, no caching, bulk queries.

### Query plan (7 queries, independent of catalog size)

1. `StudentRepository.findByUserId(userId)`
2. `prisma.track.findMany({ where: { publishedAt: { not: null } }, orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }] })` — collect (lessonId, lessonVersion) pairs
3. `prisma.lesson.findMany({ where: { OR: [{ id, version }, ...] } })`
4. `prisma.block.findMany({ where: { lessonId: { in: [...] } } })`
5. `prisma.exercise.findMany({ where: { id: { in: [...] }, publishedAt: { not: null } }, select: { id, version, concepts } })` — filter latest per id in memory
6. `prisma.exerciseResult.findMany({ where: { studentId, exerciseId: { in: [...] } } })`
7. `prisma.attempt.groupBy({ by: ['exerciseId'], where: { studentId, exerciseId: { in: [...] } }, _max: { submittedAt: true } })`

### In-memory roll-up (single pass)

- `perLessonState: Map<lessonKey, { state, lastAttemptAt }>` — A's existing logic
- `conceptCounts: Map<concept, { passed, total }>` — A's existing logic
- `lessonConcepts: Map<lessonKey, Set<concept>>` — NEW (union of concepts per lesson)

Then apply the Section-2 waterfall.

### Reuse policy

Do **not** refactor A's `getConcepts()` / `getTrackProgress()`. Add a private helper for this aggregation inside `ProgressService`. Duplication ~20 lines, acceptable to keep each public method readable in isolation. No new repositories — use `PrismaService` directly (match A).

## What's left

- [ ] **Section 4 — Web UI (dashboard panel)** — component name, placement relative to ConceptMastery + ReviewWidget, each `kind`'s visual treatment, fetch helper
- [ ] **Section 5 — Testing strategy** — platform unit + e2e, web component tests
- [ ] **Section 6 — Out of scope / deferred**
- [ ] Write spec doc to `docs/superpowers/specs/2026-04-23-adaptive-next-lesson-design.md` (tentative filename — confirm with user)
- [ ] Spec self-review (placeholder scan, internal consistency, scope check, ambiguity check)
- [ ] User reviews written spec
- [ ] Invoke `superpowers:writing-plans` skill

## Must-follow process rules

- **HARD GATE**: do not write any code, scaffold, or invoke implementation skills until spec is written and user-approved.
- `superpowers:writing-plans` is the ONLY skill to invoke after brainstorming — no frontend-design, no mcp-builder, etc.
- Spec file naming pattern: `YYYY-MM-DD-<topic>-design.md` in `docs/superpowers/specs/`. Today's date = 2026-04-23.

## Memory reminders (auto-loaded)

- Auto-accept technical recommendations on BootCamp work — don't pause for approval on judgment calls.
- Learners are experienced programmers new to Swift/Kotlin — no "what is a variable" framing.
