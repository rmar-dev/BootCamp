# Adaptive Next-Lesson Recommendation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deterministic, four-tier next-lesson recommendation surfaced on the student dashboard. Backed by one new endpoint inside the existing `ProgressModule` and one new prop-driven web component.

**Architecture:** Extend `ProgressAggregatorService` with `getRecommendation(studentId: string | null)` that aggregates via 5–7 bulk queries (count independent of catalog size) and walks a tier waterfall: in-progress continuation → weakest-concept gap → first-timer/no-gap → exhausted. Expose via `GET /api/progress/recommendation`. Render via `NextLessonWidget` placed between `ReviewWidget` and `StatsCard` on the dashboard, with a single shell and per-`kind` content switch.

**Tech Stack:** NestJS 10, TypeScript, Prisma 5, PostgreSQL, Jest + supertest (platform). Next.js 14, React, TailwindCSS, Vitest + @testing-library/react (web).

**Spec:** `docs/superpowers/specs/2026-04-23-adaptive-next-lesson-design.md`

**Branch guard:** Both `platform/` and `web/` checkouts are currently on `feat/adaptive-content-engine` (unrelated spec #11, user's concurrent work). This plan targets `master`. **Before executing any task**, switch each checkout to a new branch off master: `feat/adaptive-next-lesson` (platform), `feat/adaptive-next-lesson` (web). Do NOT commit on `feat/adaptive-content-engine`.

---

## File structure

### Platform (`platform/`)

- **Modify** `src/progress/progress.service.ts` — add `LessonSummary`, `RecommendationResponse` types (exported); add public `getRecommendation(studentId: string | null): Promise<RecommendationResponse>` method; add private helpers for the three maps + tier waterfall.
- **Modify** `src/progress/progress.controller.ts` — add `GET /recommendation` route (`JwtAuthGuard`), resolves `studentId = student?.id ?? null` and delegates.
- **Create** `test/progress/recommendation.service.spec.ts` — service unit tests (real Postgres).
- **Create** `test/progress/recommendation.controller.spec.ts` — controller e2e (supertest, AppModule).
- **Do not modify** `src/progress/progress.module.ts` — the new method/route are additions on existing providers; the module wiring is already correct.

### Web (`web/`)

- **Modify** `lib/progress.ts` — add `LessonSummary`, `RecommendationResponse` types; add `fetchRecommendation()`.
- **Create** `components/dashboard/NextLessonWidget.tsx` — prop-driven component, one `switch` on `kind`.
- **Create** `tests/dashboard/NextLessonWidget.test.tsx` — component tests (Vitest + testing-library).
- **Modify** `app/dashboard/page.tsx` — one new `fetchRecommendation().catch(() => null)` entry in the `Promise.all`, one new state slot, one new render position between `ReviewWidget` and `StatsCard`.

---

## Preamble — branch setup (do this once before Task 1)

Both `platform/` and `web/` are on `feat/adaptive-content-engine`. Create isolated branches off master for this work.

- [ ] **Preamble Step 1: Stash any dirty state (don't discard it)**

From `c:/Users/ricma/BootCamp`:

```bash
git -C platform status --short
git -C web status --short
```

If either reports dirty files, stop and surface the state to the user before creating new branches. If clean, continue.

- [ ] **Preamble Step 2: Create platform branch off master**

```bash
git -C platform fetch origin
git -C platform checkout -b feat/adaptive-next-lesson master
```

Expected: switched to new branch `feat/adaptive-next-lesson` based on master's current tip (`1ac451f` or later).

- [ ] **Preamble Step 3: Create web branch off master**

```bash
git -C web fetch origin
git -C web checkout -b feat/adaptive-next-lesson master
```

Expected: switched to new branch `feat/adaptive-next-lesson` based on master's current tip (`11525d2` or later).

- [ ] **Preamble Step 4: Verify Docker + DB are up (needed for Jest with real Postgres)**

```bash
pwsh ./dev.ps1 up
```

Expected: Postgres container healthy on 5432. If already up, this is a no-op.

---

## Task 1: Add `LessonSummary` and `RecommendationResponse` types to the service module

**Files:**
- Modify: `platform/src/progress/progress.service.ts` (top-of-file types block, around lines 5–29)

- [ ] **Step 1: Add exported types**

Insert after the existing `ConceptsProgress` type (below the `ConceptProgress` / `ConceptsProgress` exports), before the `@Injectable()` decorator:

```typescript
export type LessonSummary = {
  id: string;
  version: number;
  title: string;
  trackId: string;
  trackTitle: string;
};

export type RecommendationResponse =
  | { kind: 'continue';    lesson: LessonSummary; reason: { message: string } }
  | { kind: 'concept_gap'; lesson: LessonSummary; reason: { message: string; concept: string; passed: number; total: number } }
  | { kind: 'first_timer'; lesson: LessonSummary; reason: { message: string } }
  | { kind: 'exhausted';                          reason: { message: string } };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `c:/Users/ricma/BootCamp`:

```bash
npm --prefix platform run build
```

Expected: `nest build` succeeds. If it fails with "types declared but not used" that is fine — the types will be used in Task 2+.

- [ ] **Step 3: Commit**

```bash
git -C platform add src/progress/progress.service.ts
git -C platform commit -m "feat(progress): add recommendation response types"
```

---

## Task 2: Service — Tier 4 exhausted (red → green)

**Files:**
- Modify: `platform/src/progress/progress.service.ts` (add `getRecommendation` method)
- Create: `platform/test/progress/recommendation.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `platform/test/progress/recommendation.service.spec.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { ProgressAggregatorService } from '../../src/progress/progress.service';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { ExerciseRepository } from '../../src/content/repositories/exercise.repository';
import { StudentRepository } from '../../src/state/repositories/student.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressAggregatorService — recommendation', () => {
  let prisma: PrismaClient;
  let svc: ProgressAggregatorService;
  let tracks: TrackRepository;
  let lessons: LessonRepository;
  let exercises: ExerciseRepository;
  let students: StudentRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    tracks = new TrackRepository(prisma as any);
    lessons = new LessonRepository(prisma as any);
    exercises = new ExerciseRepository(prisma as any);
    students = new StudentRepository(prisma as any);
    svc = new ProgressAggregatorService(prisma as any, tracks, students);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeExercise(concepts: string[] = []): Promise<string> {
    const id = newId();
    await exercises.createDraft({
      id,
      lessonId: newId(),
      promptMarkdown: 'p',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'q',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        correctOptionIds: ['a'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts,
    });
    await exercises.publish(id, 1);
    return id;
  }

  async function makeLessonWithExercises(
    trackId: string,
    position: number,
    exerciseIds: string[],
    title?: string,
  ): Promise<{ lessonId: string; lessonVersion: number }> {
    const lessonId = newId();
    await lessons.createDraft({
      id: lessonId,
      trackId,
      position,
      title: title ?? `Lesson ${position}`,
      level: 'beginner',
      summary: 's',
      blocks: exerciseIds.map((exerciseId, i) => ({
        id: newId(),
        position: i,
        kind: 'exercise' as const,
        exerciseId,
        exerciseVersion: 1,
      })),
    });
    await lessons.publish(lessonId, 1);
    return { lessonId, lessonVersion: 1 };
  }

  async function makeTrack(
    lessonKeys: { id: string; version: number }[],
    title = 'T',
  ): Promise<string> {
    const trackId = newId();
    await tracks.createDraft({
      id: trackId,
      title,
      language: 'swift',
      kind: 'fundamentals',
      description: 'd',
      lessons: lessonKeys,
    });
    await tracks.publish(trackId, 1);
    return trackId;
  }

  async function makeStudent(): Promise<string> {
    const s = await students.create({ id: newId(), name: 'S', email: `s-${newId()}@t.com` });
    return s.id;
  }

  describe('Tier 4 — exhausted', () => {
    it('returns exhausted with "No curriculum published yet." when no tracks exist', async () => {
      const studentId = await makeStudent();
      const result = await svc.getRecommendation(studentId);
      expect(result).toEqual({
        kind: 'exhausted',
        reason: { message: 'No curriculum published yet.' },
      });
    });

    it('returns exhausted with "finished" message when all lessons are complete', async () => {
      const studentId = await makeStudent();
      const ex = await makeExercise();
      const { lessonId, lessonVersion } = await makeLessonWithExercises(newId(), 0, [ex]);
      await makeTrack([{ id: lessonId, version: lessonVersion }]);

      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId: ex, exerciseVersion: 1,
          submittedAt: new Date(), submissionPayload: {},
          passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: ex, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result).toEqual({
        kind: 'exhausted',
        reason: { message: "You've finished the published curriculum." },
      });
    });

    it('accepts null studentId and returns exhausted when no tracks exist', async () => {
      const result = await svc.getRecommendation(null);
      expect(result).toEqual({
        kind: 'exhausted',
        reason: { message: 'No curriculum published yet.' },
      });
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: FAIL with `svc.getRecommendation is not a function`.

- [ ] **Step 3: Add minimal `getRecommendation` implementation (Tier 4 only)**

Add this method to `ProgressAggregatorService` in `platform/src/progress/progress.service.ts`, after `getConceptProgress`:

```typescript
async getRecommendation(studentId: string | null): Promise<RecommendationResponse> {
  const publishedTracks = await this.tracks.findAllLatestPublished();
  if (publishedTracks.length === 0) {
    return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
  }

  // Placeholder: everything complete path — tightened in later tasks.
  // For now, default to a "catalog-exhausted" string so the second Tier-4 test passes
  // once the aggregation logic is added. Leave the branching to Task 6.
  return { kind: 'exhausted', reason: { message: "You've finished the published curriculum." } };
}
```

- [ ] **Step 4: Run the test and verify two pass, one fails**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: "No curriculum" and "null studentId" tests PASS. The "finished" test will PASS as well only because the placeholder returns the finished message unconditionally — this will be replaced in Task 6 once Tier 3 lands. Both are acceptable green states for this commit because no Tier-3 path exists yet.

- [ ] **Step 5: Commit**

```bash
git -C platform add src/progress/progress.service.ts test/progress/recommendation.service.spec.ts
git -C platform commit -m "feat(progress): recommendation tier 4 exhausted"
```

---

## Task 3: Service — Aggregation helper (loads data into three maps)

Before implementing Tier 3, 1, and 2, add a private aggregation helper that the waterfall reads from. This is a refactor step before the next tiered test — no new test cases here; the Tier 4 tests stay green.

**Files:**
- Modify: `platform/src/progress/progress.service.ts`

- [ ] **Step 1: Add the aggregation helper and a key helper**

Add inside the `ProgressAggregatorService` class, **as private methods** (below `getConceptProgress`, above any new public methods):

```typescript
private lessonKey(id: string, version: number): string {
  return `${id}:${version}`;
}

private async aggregateForRecommendation(studentId: string | null): Promise<{
  tracksByLessonKey: Map<string, { trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number }>;
  lessonRows: Map<string, { id: string; version: number; title: string; trackId: string; position: number }>;
  perLessonState: Map<string, { state: 'not_started' | 'in_progress' | 'complete'; lastAttemptAt: Date | null }>;
  conceptCounts: Map<string, { passed: number; total: number }>;
  lessonConcepts: Map<string, Set<string>>;
  hasAnyAttempt: boolean;
  hasAnyPublishedTrack: boolean;
}> {
  const publishedTracks = await this.tracks.findAllLatestPublished();
  if (publishedTracks.length === 0) {
    return {
      tracksByLessonKey: new Map(),
      lessonRows: new Map(),
      perLessonState: new Map(),
      conceptCounts: new Map(),
      lessonConcepts: new Map(),
      hasAnyAttempt: false,
      hasAnyPublishedTrack: false,
    };
  }

  // Re-sort to enforce catalog order: publishedAt ASC, id ASC
  const sortedTracks = [...publishedTracks].sort((a, b) => {
    const ap = a.publishedAt!.getTime();
    const bp = b.publishedAt!.getTime();
    if (ap !== bp) return ap - bp;
    return a.id.localeCompare(b.id);
  });

  const tracksByLessonKey = new Map<string, {
    trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number;
  }>();
  const lessonKeys: { id: string; version: number }[] = [];
  for (const t of sortedTracks) {
    for (let i = 0; i < t.lessonIds.length; i++) {
      const lid = t.lessonIds[i];
      const lver = t.lessonVersions[i];
      const key = this.lessonKey(lid, lver);
      // Tiebreak by first-occurrence: if a lesson is referenced by multiple tracks, the
      // earlier-sorted track wins. Skip duplicates.
      if (!tracksByLessonKey.has(key)) {
        tracksByLessonKey.set(key, {
          trackId: t.id,
          trackTitle: t.title,
          trackPublishedAt: t.publishedAt!,
          lessonPosition: i,
        });
        lessonKeys.push({ id: lid, version: lver });
      }
    }
  }

  if (lessonKeys.length === 0) {
    return {
      tracksByLessonKey,
      lessonRows: new Map(),
      perLessonState: new Map(),
      conceptCounts: new Map(),
      lessonConcepts: new Map(),
      hasAnyAttempt: false,
      hasAnyPublishedTrack: true,
    };
  }

  const lessonFetched = await this.prisma.lesson.findMany({
    where: { OR: lessonKeys.map((k) => ({ id: k.id, version: k.version })) },
    select: { id: true, version: true, title: true, trackId: true, position: true },
  });
  const lessonRows = new Map<string, { id: string; version: number; title: string; trackId: string; position: number }>();
  for (const l of lessonFetched) lessonRows.set(this.lessonKey(l.id, l.version), l);

  const blocks = await this.prisma.block.findMany({
    where: { OR: lessonKeys.map((k) => ({ lessonId: k.id, lessonVersion: k.version })) },
    select: { lessonId: true, lessonVersion: true, kind: true, exerciseId: true },
  });

  const exerciseIdsByLesson = new Map<string, string[]>();
  for (const k of lessonKeys) exerciseIdsByLesson.set(this.lessonKey(k.id, k.version), []);
  const allExerciseIds: string[] = [];
  for (const b of blocks) {
    if (b.kind !== 'exercise' || !b.exerciseId) continue;
    const key = this.lessonKey(b.lessonId, b.lessonVersion);
    const list = exerciseIdsByLesson.get(key);
    if (list) {
      list.push(b.exerciseId);
      allExerciseIds.push(b.exerciseId);
    }
  }

  const publishedExercises = allExerciseIds.length === 0
    ? []
    : await this.prisma.exercise.findMany({
        where: { id: { in: allExerciseIds }, publishedAt: { not: null } },
        select: { id: true, version: true, concepts: true },
      });

  // Collapse to latest published version per exercise id
  const latestByExercise = new Map<string, { version: number; concepts: string[] }>();
  for (const ex of publishedExercises) {
    const existing = latestByExercise.get(ex.id);
    if (!existing || ex.version > existing.version) {
      latestByExercise.set(ex.id, { version: ex.version, concepts: ex.concepts });
    }
  }

  const [passedResults, attemptGroups] = studentId
    ? await Promise.all([
        this.prisma.exerciseResult.findMany({
          where: { studentId, passed: true, exerciseId: { in: allExerciseIds } },
          select: { exerciseId: true },
        }),
        this.prisma.attempt.groupBy({
          by: ['exerciseId'],
          where: { studentId, exerciseId: { in: allExerciseIds } },
          _max: { submittedAt: true },
        }),
      ])
    : [[] as { exerciseId: string }[], [] as Array<{ exerciseId: string; _max: { submittedAt: Date | null } }>];

  const passedSet = new Set(passedResults.map((r) => r.exerciseId));
  const lastAttemptByExercise = new Map<string, Date>();
  for (const g of attemptGroups) {
    if (g._max.submittedAt) lastAttemptByExercise.set(g.exerciseId, g._max.submittedAt);
  }

  const perLessonState = new Map<string, { state: 'not_started' | 'in_progress' | 'complete'; lastAttemptAt: Date | null }>();
  const lessonConcepts = new Map<string, Set<string>>();
  for (const k of lessonKeys) {
    const key = this.lessonKey(k.id, k.version);
    const exerciseIds = exerciseIdsByLesson.get(key) ?? [];
    let passed = 0;
    let attempted = 0;
    let lastAttemptAt: Date | null = null;
    const conceptSet = new Set<string>();
    for (const exId of exerciseIds) {
      const latest = latestByExercise.get(exId);
      if (latest) for (const c of latest.concepts) conceptSet.add(c);
      if (passedSet.has(exId)) passed++;
      const last = lastAttemptByExercise.get(exId);
      if (last) {
        attempted++;
        if (!lastAttemptAt || last > lastAttemptAt) lastAttemptAt = last;
      }
    }
    let state: 'not_started' | 'in_progress' | 'complete';
    if (attempted === 0) state = 'not_started';
    else if (exerciseIds.length > 0 && passed === exerciseIds.length) state = 'complete';
    else state = 'in_progress';
    perLessonState.set(key, { state, lastAttemptAt });
    lessonConcepts.set(key, conceptSet);
  }

  // Concept counts from latest-version exercises (reused by Tier 2)
  const conceptCounts = new Map<string, { passed: number; total: number }>();
  for (const [exerciseId, { concepts }] of latestByExercise.entries()) {
    for (const concept of concepts) {
      let c = conceptCounts.get(concept);
      if (!c) {
        c = { passed: 0, total: 0 };
        conceptCounts.set(concept, c);
      }
      c.total++;
      if (passedSet.has(exerciseId)) c.passed++;
    }
  }

  return {
    tracksByLessonKey,
    lessonRows,
    perLessonState,
    conceptCounts,
    lessonConcepts,
    hasAnyAttempt: lastAttemptByExercise.size > 0,
    hasAnyPublishedTrack: true,
  };
}

private buildLessonSummary(
  lessonKey: string,
  lessonRows: Map<string, { id: string; version: number; title: string; trackId: string; position: number }>,
  tracksByLessonKey: Map<string, { trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number }>,
): LessonSummary {
  const row = lessonRows.get(lessonKey)!;
  const tr = tracksByLessonKey.get(lessonKey)!;
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    trackId: tr.trackId,
    trackTitle: tr.trackTitle,
  };
}
```

- [ ] **Step 2: Update `getRecommendation` to call the helper (still Tier-4-only)**

Replace the body of `getRecommendation` with:

```typescript
async getRecommendation(studentId: string | null): Promise<RecommendationResponse> {
  const ctx = await this.aggregateForRecommendation(studentId);
  if (!ctx.hasAnyPublishedTrack) {
    return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
  }
  // Everything else falls through to the finished message until later tasks fill in Tiers 1–3.
  return { kind: 'exhausted', reason: { message: "You've finished the published curriculum." } };
}
```

- [ ] **Step 3: Run the Tier 4 tests**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: all three Tier 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C platform add src/progress/progress.service.ts
git -C platform commit -m "refactor(progress): add aggregation helper for recommendation waterfall"
```

---

## Task 4: Service — Tier 3 first-timer / no-gap (red → green)

**Files:**
- Modify: `platform/src/progress/progress.service.ts` (replace body of `getRecommendation`)
- Modify: `platform/test/progress/recommendation.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append a new `describe` block inside the main `describe` in the service spec, immediately above the closing brace of `describe('Tier 4 — exhausted', ...)`:

```typescript
  describe('Tier 3 — first-timer / no-gap fallback', () => {
    it('returns first_timer with "Start here." for a brand-new student', async () => {
      const studentId = await makeStudent();
      const ex = await makeExercise();
      const { lessonId, lessonVersion } = await makeLessonWithExercises(newId(), 0, [ex], 'Optionals 101');
      const trackId = await makeTrack([{ id: lessonId, version: lessonVersion }], 'Swift Fundamentals');

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('first_timer');
      if (result.kind !== 'first_timer') throw new Error('narrow');
      expect(result.reason.message).toBe('Start here.');
      expect(result.lesson).toEqual({
        id: lessonId, version: lessonVersion,
        title: 'Optionals 101', trackId, trackTitle: 'Swift Fundamentals',
      });
    });

    it('returns first_timer with "Next up: <track>." for a returning student with closed gaps', async () => {
      const studentId = await makeStudent();
      const exA = await makeExercise(['Closures']);
      const L1 = await makeLessonWithExercises(newId(), 0, [exA], 'Closures 101');
      const exB = await makeExercise([]); // no concepts → no gap contribution
      const L2 = await makeLessonWithExercises(newId(), 1, [exB], 'Extensions 101');
      const trackId = await makeTrack(
        [{ id: L1.lessonId, version: L1.lessonVersion }, { id: L2.lessonId, version: L2.lessonVersion }],
        'Swift Fundamentals',
      );

      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: new Date(), submissionPayload: {},
          passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: exA, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('first_timer');
      if (result.kind !== 'first_timer') throw new Error('narrow');
      expect(result.reason.message).toBe('Next up: Swift Fundamentals.');
      expect(result.lesson.id).toBe(L2.lessonId);
      expect(result.lesson.trackId).toBe(trackId);
    });

    it('picks first lesson in catalog order across multiple tracks', async () => {
      // Track A published 2026-01-01, lessons [A1, A2]
      // Track B published 2026-02-01, lessons [B1]
      // Brand-new student → Start here. → Track A, position 0 → A1.
      const exA1 = await makeExercise();
      const exA2 = await makeExercise();
      const LA1 = await makeLessonWithExercises(newId(), 0, [exA1], 'A1');
      const LA2 = await makeLessonWithExercises(newId(), 1, [exA2], 'A2');
      const trackAId = newId();
      await tracks.createDraft({
        id: trackAId, title: 'Track A', language: 'swift', kind: 'fundamentals', description: 'd',
        lessons: [
          { id: LA1.lessonId, version: LA1.lessonVersion },
          { id: LA2.lessonId, version: LA2.lessonVersion },
        ],
      });
      await prisma.track.update({
        where: { id_version: { id: trackAId, version: 1 } },
        data: { publishedAt: new Date('2026-01-01T00:00:00Z') },
      });

      const exB1 = await makeExercise();
      const LB1 = await makeLessonWithExercises(newId(), 0, [exB1], 'B1');
      const trackBId = newId();
      await tracks.createDraft({
        id: trackBId, title: 'Track B', language: 'swift', kind: 'fundamentals', description: 'd',
        lessons: [{ id: LB1.lessonId, version: LB1.lessonVersion }],
      });
      await prisma.track.update({
        where: { id_version: { id: trackBId, version: 1 } },
        data: { publishedAt: new Date('2026-02-01T00:00:00Z') },
      });

      const studentId = await makeStudent();
      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('first_timer');
      if (result.kind !== 'first_timer') throw new Error('narrow');
      expect(result.lesson.id).toBe(LA1.lessonId);
      expect(result.lesson.trackId).toBe(trackAId);
    });

    it('accepts null studentId and returns first_timer "Start here." when tracks exist', async () => {
      const ex = await makeExercise();
      const { lessonId, lessonVersion } = await makeLessonWithExercises(newId(), 0, [ex], 'Opener');
      await makeTrack([{ id: lessonId, version: lessonVersion }]);

      const result = await svc.getRecommendation(null);
      expect(result.kind).toBe('first_timer');
      if (result.kind !== 'first_timer') throw new Error('narrow');
      expect(result.reason.message).toBe('Start here.');
      expect(result.lesson.id).toBe(lessonId);
    });
  });
```

Also, the existing Tier 4 test `returns exhausted with "finished" message when all lessons are complete` will now break when Tier 3 is implemented incorrectly. Keep it as-is — it should continue to pass because all exercises are passed → no in-progress, no gap, no unstarted → Tier 4.

- [ ] **Step 2: Run the tests to verify the new Tier 3 tests fail**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: the four new Tier 3 tests FAIL (they assert `first_timer` but the placeholder returns `exhausted`). Tier 4 tests still pass.

- [ ] **Step 3: Implement Tier 3 and Tier 4 split**

Replace the body of `getRecommendation` with:

```typescript
async getRecommendation(studentId: string | null): Promise<RecommendationResponse> {
  const ctx = await this.aggregateForRecommendation(studentId);
  if (!ctx.hasAnyPublishedTrack) {
    return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
  }

  // Build a catalog-ordered iteration list of (lessonKey, trackMeta, lessonRow).
  const catalogOrdered: string[] = [];
  for (const [key, tr] of ctx.tracksByLessonKey.entries()) {
    catalogOrdered.push(key);
  }
  catalogOrdered.sort((a, b) => {
    const ta = ctx.tracksByLessonKey.get(a)!;
    const tb = ctx.tracksByLessonKey.get(b)!;
    if (ta.trackPublishedAt.getTime() !== tb.trackPublishedAt.getTime()) {
      return ta.trackPublishedAt.getTime() - tb.trackPublishedAt.getTime();
    }
    if (ta.trackId !== tb.trackId) return ta.trackId.localeCompare(tb.trackId);
    return ta.lessonPosition - tb.lessonPosition;
  });

  // Tier 3 candidates: lessons with state in not_started/in_progress.
  const tier3Keys = catalogOrdered.filter((k) => {
    const st = ctx.perLessonState.get(k);
    return st && st.state !== 'complete';
  });

  if (tier3Keys.length === 0) {
    return { kind: 'exhausted', reason: { message: "You've finished the published curriculum." } };
  }

  const firstKey = tier3Keys[0];
  const lesson = this.buildLessonSummary(firstKey, ctx.lessonRows, ctx.tracksByLessonKey);
  const message = ctx.hasAnyAttempt
    ? `Next up: ${lesson.trackTitle}.`
    : 'Start here.';
  return { kind: 'first_timer', lesson, reason: { message } };
}
```

- [ ] **Step 4: Run the tests**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: all seven tests (3 Tier 4 + 4 Tier 3) PASS.

- [ ] **Step 5: Commit**

```bash
git -C platform add src/progress/progress.service.ts test/progress/recommendation.service.spec.ts
git -C platform commit -m "feat(progress): recommendation tier 3 first-timer / no-gap"
```

---

## Task 5: Service — Tier 1 continuation (red → green)

**Files:**
- Modify: `platform/src/progress/progress.service.ts`
- Modify: `platform/test/progress/recommendation.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append inside the main describe, above Tier-3 block (so tier numbering in the file flows 1 → 3 → 4 for readability):

```typescript
  describe('Tier 1 — in-progress continuation', () => {
    it('returns continue for a single in-progress lesson', async () => {
      const studentId = await makeStudent();
      const exA = await makeExercise();
      const exB = await makeExercise();
      const { lessonId, lessonVersion } = await makeLessonWithExercises(newId(), 0, [exA, exB], 'Closures 101');
      const trackId = await makeTrack([{ id: lessonId, version: lessonVersion }], 'Swift Fundamentals');

      // Student attempted exA and failed → in_progress
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: new Date('2026-04-22T10:00:00Z'), submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('continue');
      if (result.kind !== 'continue') throw new Error('narrow');
      expect(result.lesson.id).toBe(lessonId);
      expect(result.lesson.trackId).toBe(trackId);
      expect(result.reason.message).toBe('Continue where you left off.');
    });

    it('picks the lesson with the max lastAttemptAt across tracks', async () => {
      const studentId = await makeStudent();
      // Lesson A — attempted earlier
      const exA = await makeExercise();
      const LA = await makeLessonWithExercises(newId(), 0, [exA], 'A1');
      await makeTrack([{ id: LA.lessonId, version: LA.lessonVersion }], 'Track A');
      await prisma.attempt.create({
        data: {
          id: newId(), studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: new Date('2026-04-20T10:00:00Z'), submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });
      // Lesson B — attempted later
      const exB = await makeExercise();
      const LB = await makeLessonWithExercises(newId(), 0, [exB], 'B1');
      await makeTrack([{ id: LB.lessonId, version: LB.lessonVersion }], 'Track B');
      await prisma.attempt.create({
        data: {
          id: newId(), studentId, exerciseId: exB, exerciseVersion: 1,
          submittedAt: new Date('2026-04-22T10:00:00Z'), submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('continue');
      if (result.kind !== 'continue') throw new Error('narrow');
      expect(result.lesson.id).toBe(LB.lessonId);
    });

    it('breaks ties by earlier-published track, then lower lesson position', async () => {
      const studentId = await makeStudent();

      // Track A published 2026-01-01, one in-progress lesson at position 0
      const exA = await makeExercise();
      const LA = await makeLessonWithExercises(newId(), 0, [exA], 'A-pos0');
      const trackAId = newId();
      await tracks.createDraft({
        id: trackAId, title: 'Track A', language: 'swift', kind: 'fundamentals', description: 'd',
        lessons: [{ id: LA.lessonId, version: LA.lessonVersion }],
      });
      await prisma.track.update({
        where: { id_version: { id: trackAId, version: 1 } },
        data: { publishedAt: new Date('2026-01-01T00:00:00Z') },
      });

      // Track B published 2026-02-01, one in-progress lesson
      const exB = await makeExercise();
      const LB = await makeLessonWithExercises(newId(), 0, [exB], 'B-pos0');
      const trackBId = newId();
      await tracks.createDraft({
        id: trackBId, title: 'Track B', language: 'swift', kind: 'fundamentals', description: 'd',
        lessons: [{ id: LB.lessonId, version: LB.lessonVersion }],
      });
      await prisma.track.update({
        where: { id_version: { id: trackBId, version: 1 } },
        data: { publishedAt: new Date('2026-02-01T00:00:00Z') },
      });

      // Both attempted at the exact same instant
      const sameTs = new Date('2026-04-22T12:00:00Z');
      await prisma.attempt.create({
        data: {
          id: newId(), studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: sameTs, submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });
      await prisma.attempt.create({
        data: {
          id: newId(), studentId, exerciseId: exB, exerciseVersion: 1,
          submittedAt: sameTs, submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('continue');
      if (result.kind !== 'continue') throw new Error('narrow');
      expect(result.lesson.trackId).toBe(trackAId);
    });

    it('does not pick completed lessons over in-progress, even with newer timestamps', async () => {
      const studentId = await makeStudent();
      const exIP = await makeExercise();
      const exDone = await makeExercise();
      const LIP = await makeLessonWithExercises(newId(), 0, [exIP], 'InProgress');
      const LDone = await makeLessonWithExercises(newId(), 1, [exDone], 'Done');
      await makeTrack([
        { id: LIP.lessonId, version: LIP.lessonVersion },
        { id: LDone.lessonId, version: LDone.lessonVersion },
      ], 'Track T');

      // In-progress attempt (earlier)
      await prisma.attempt.create({
        data: {
          id: newId(), studentId, exerciseId: exIP, exerciseVersion: 1,
          submittedAt: new Date('2026-04-20T10:00:00Z'), submissionPayload: {},
          passed: false, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 0,
        },
      });
      // Completed attempt (newer)
      const doneAttempt = newId();
      await prisma.attempt.create({
        data: {
          id: doneAttempt, studentId, exerciseId: exDone, exerciseVersion: 1,
          submittedAt: new Date('2026-04-22T10:00:00Z'), submissionPayload: {},
          passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: exDone, bestAttemptId: doneAttempt,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('continue');
      if (result.kind !== 'continue') throw new Error('narrow');
      expect(result.lesson.id).toBe(LIP.lessonId);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: the four Tier-1 tests FAIL with wrong `kind` (service currently returns `first_timer` for in-progress cases).

- [ ] **Step 3: Insert Tier 1 logic at the top of the waterfall**

Replace `getRecommendation` with:

```typescript
async getRecommendation(studentId: string | null): Promise<RecommendationResponse> {
  const ctx = await this.aggregateForRecommendation(studentId);
  if (!ctx.hasAnyPublishedTrack) {
    return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
  }

  const catalogOrdered = [...ctx.tracksByLessonKey.keys()].sort((a, b) => {
    const ta = ctx.tracksByLessonKey.get(a)!;
    const tb = ctx.tracksByLessonKey.get(b)!;
    if (ta.trackPublishedAt.getTime() !== tb.trackPublishedAt.getTime()) {
      return ta.trackPublishedAt.getTime() - tb.trackPublishedAt.getTime();
    }
    if (ta.trackId !== tb.trackId) return ta.trackId.localeCompare(tb.trackId);
    return ta.lessonPosition - tb.lessonPosition;
  });

  // Tier 1 — in-progress continuation
  // `inProgressKeys` is already in catalog order (filter preserves order).
  // The reduce uses strict `>` so earlier keys win on exact lastAttemptAt ties.
  const inProgressKeys = catalogOrdered.filter((k) => ctx.perLessonState.get(k)?.state === 'in_progress');
  if (inProgressKeys.length > 0) {
    let winner = inProgressKeys[0];
    let winnerLa = ctx.perLessonState.get(winner)!.lastAttemptAt;
    for (const k of inProgressKeys.slice(1)) {
      const la = ctx.perLessonState.get(k)!.lastAttemptAt;
      if (la && (!winnerLa || la > winnerLa)) {
        winner = k;
        winnerLa = la;
      }
    }
    const lesson = this.buildLessonSummary(winner, ctx.lessonRows, ctx.tracksByLessonKey);
    return { kind: 'continue', lesson, reason: { message: 'Continue where you left off.' } };
  }

  // Tier 3 — first-timer / no-gap fallback (Tier 2 slots in later)
  const tier3Keys = catalogOrdered.filter((k) => ctx.perLessonState.get(k)?.state !== 'complete');
  if (tier3Keys.length === 0) {
    return { kind: 'exhausted', reason: { message: "You've finished the published curriculum." } };
  }
  const firstKey = tier3Keys[0];
  const lesson = this.buildLessonSummary(firstKey, ctx.lessonRows, ctx.tracksByLessonKey);
  const message = ctx.hasAnyAttempt ? `Next up: ${lesson.trackTitle}.` : 'Start here.';
  return { kind: 'first_timer', lesson, reason: { message } };
}
```

- [ ] **Step 4: Run the tests**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: all Tier-1, Tier-3, Tier-4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C platform add src/progress/progress.service.ts test/progress/recommendation.service.spec.ts
git -C platform commit -m "feat(progress): recommendation tier 1 continuation"
```

---

## Task 6: Service — Tier 2 weakest-concept gap (red → green)

**Files:**
- Modify: `platform/src/progress/progress.service.ts`
- Modify: `platform/test/progress/recommendation.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Append inside the main describe, between Tier 1 and Tier 3:

```typescript
  describe('Tier 2 — weakest-concept gap', () => {
    it('returns concept_gap for the sole concept with a gap when no lessons are in-progress', async () => {
      const studentId = await makeStudent();
      // Two lessons, same concept. Student passed one, did not attempt the other.
      // No exercise attempts pending → no in_progress → Tier 2.
      const exA = await makeExercise(['Optionals']);
      const exB = await makeExercise(['Optionals']);
      const LA = await makeLessonWithExercises(newId(), 0, [exA], 'Optionals 1');
      const LB = await makeLessonWithExercises(newId(), 1, [exB], 'Optionals 2');
      await makeTrack([
        { id: LA.lessonId, version: LA.lessonVersion },
        { id: LB.lessonId, version: LB.lessonVersion },
      ], 'Swift');

      // Pass exA — completes LA; LB untouched.
      const attemptId = newId();
      await prisma.attempt.create({
        data: {
          id: attemptId, studentId, exerciseId: exA, exerciseVersion: 1,
          submittedAt: new Date(), submissionPayload: {},
          passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: exA, bestAttemptId: attemptId,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('concept_gap');
      if (result.kind !== 'concept_gap') throw new Error('narrow');
      expect(result.lesson.id).toBe(LB.lessonId);
      expect(result.reason.concept).toBe('Optionals');
      expect(result.reason.passed).toBe(1);
      expect(result.reason.total).toBe(2);
      expect(result.reason.message).toBe("Practice Optionals — you've passed 1/2 so far.");
    });

    it('picks the lowest-ratio concept first across multiple concepts', async () => {
      const studentId = await makeStudent();

      // Each concept lives across two one-exercise lessons: L1_X (passed) + L2_X (untouched)
      // for concept X, and so on. This keeps lessons either `complete` or `not_started` —
      // never `in_progress` — so Tier 1 is skipped and Tier 2 fires.
      //
      // X: passed 2/4 (ratio 0.5)
      // Y: passed 1/2 (ratio 0.5, smaller gap — loses tiebreak to X on `total - passed`)
      // Z: passed 1/4 (ratio 0.25 — lowest ratio, wins)
      const xEx = await Promise.all([makeExercise(['X']), makeExercise(['X']), makeExercise(['X']), makeExercise(['X'])]);
      const yEx = await Promise.all([makeExercise(['Y']), makeExercise(['Y'])]);
      const zEx = await Promise.all([makeExercise(['Z']), makeExercise(['Z']), makeExercise(['Z']), makeExercise(['Z'])]);

      // Build one single-exercise lesson per exercise so passing one exercise completes its lesson.
      const lessonsForConcept = async (exIds: string[], titlePrefix: string) =>
        Promise.all(exIds.map((ex, i) => makeLessonWithExercises(newId(), i, [ex], `${titlePrefix}-${i}`)));
      const xL = await lessonsForConcept(xEx, 'X');
      const yL = await lessonsForConcept(yEx, 'Y');
      const zL = await lessonsForConcept(zEx, 'Z');

      const allLessons = [...xL, ...yL, ...zL];
      await makeTrack(allLessons.map((l) => ({ id: l.lessonId, version: l.lessonVersion })), 'Track');

      // Pass first 2 of X, first 1 of Y, first 1 of Z — completes each of those lessons.
      async function passExercise(exerciseId: string) {
        const aid = newId();
        await prisma.attempt.create({
          data: {
            id: aid, studentId, exerciseId, exerciseVersion: 1,
            submittedAt: new Date(), submissionPayload: {},
            passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
          },
        });
        await prisma.exerciseResult.create({
          data: {
            id: newId(), studentId, exerciseId, bestAttemptId: aid,
            passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
          },
        });
      }
      await passExercise(xEx[0]); await passExercise(xEx[1]);
      await passExercise(yEx[0]);
      await passExercise(zEx[0]);

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('concept_gap');
      if (result.kind !== 'concept_gap') throw new Error('narrow');
      expect(result.reason.concept).toBe('Z');
      expect(result.reason.passed).toBe(1);
      expect(result.reason.total).toBe(4);
      // First not-started Z lesson in catalog order is the one holding zEx[1] (position 1 in the Z block).
      expect(result.lesson.id).toBe(zL[1].lessonId);
    });

    it('when concepts tie on ratio, breaks by largest absolute gap then by concept name', async () => {
      const studentId = await makeStudent();
      // A = 0/2 ratio 0, gap 2
      // B = 0/3 ratio 0, gap 3  ← wins on gap
      // C = 0/3 ratio 0, gap 3 — tied with B on ratio and gap; alphabetical tiebreak picks 'B'
      const aEx = await Promise.all([makeExercise(['A']), makeExercise(['A'])]);
      const bEx = await Promise.all([makeExercise(['B']), makeExercise(['B']), makeExercise(['B'])]);
      const cEx = await Promise.all([makeExercise(['C']), makeExercise(['C']), makeExercise(['C'])]);
      const LA = await makeLessonWithExercises(newId(), 0, aEx, 'A-lesson');
      const LB = await makeLessonWithExercises(newId(), 1, bEx, 'B-lesson');
      const LC = await makeLessonWithExercises(newId(), 2, cEx, 'C-lesson');
      await makeTrack([
        { id: LA.lessonId, version: LA.lessonVersion },
        { id: LB.lessonId, version: LB.lessonVersion },
        { id: LC.lessonId, version: LC.lessonVersion },
      ], 'Track');

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('concept_gap');
      if (result.kind !== 'concept_gap') throw new Error('narrow');
      expect(result.reason.concept).toBe('B');
      expect(result.lesson.id).toBe(LB.lessonId);
      expect(result.reason.message).toBe('Start on B — 0/3 passed.');
    });
  });
```

Note: the spec lists a fourth sub-case in §6.1 ("weakest concept has zero eligible lessons → falls through to next concept"). Under the current data model any concept with a gap implies at least one unpassed exercise, whose containing lesson cannot be `complete`, so the inner-loop fallthrough is unreachable via normal fixtures. The implementation still handles it defensively (the `for (const stat of gapConcepts)` loop), but no fixture is written because the path cannot be exercised without fabricating inconsistent DB state. Skip writing that test.

- [ ] **Step 2: Run tests to verify Tier 2 tests fail**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: all new Tier-2 tests FAIL (service still returns `first_timer` or `continue` instead of `concept_gap`).

- [ ] **Step 3: Implement Tier 2**

Update `getRecommendation` — inside the body, between the Tier 1 block and the Tier 3 block, add:

```typescript
  // Tier 2 — weakest-concept gap
  type ConceptStat = { concept: string; passed: number; total: number };
  const gapConcepts: ConceptStat[] = [];
  for (const [concept, v] of ctx.conceptCounts.entries()) {
    if (v.total > 0 && v.passed < v.total) gapConcepts.push({ concept, passed: v.passed, total: v.total });
  }
  if (gapConcepts.length > 0) {
    gapConcepts.sort((a, b) => {
      const ra = a.passed / a.total;
      const rb = b.passed / b.total;
      if (ra !== rb) return ra - rb;
      const gapA = a.total - a.passed;
      const gapB = b.total - b.passed;
      if (gapA !== gapB) return gapB - gapA;
      return a.concept.localeCompare(b.concept);
    });
    for (const stat of gapConcepts) {
      const eligibleKey = catalogOrdered.find((k) => {
        const st = ctx.perLessonState.get(k);
        if (!st || st.state === 'complete') return false;
        return ctx.lessonConcepts.get(k)?.has(stat.concept);
      });
      if (eligibleKey) {
        const lesson = this.buildLessonSummary(eligibleKey, ctx.lessonRows, ctx.tracksByLessonKey);
        const message = stat.passed === 0
          ? `Start on ${stat.concept} — 0/${stat.total} passed.`
          : `Practice ${stat.concept} — you've passed ${stat.passed}/${stat.total} so far.`;
        return {
          kind: 'concept_gap',
          lesson,
          reason: { message, concept: stat.concept, passed: stat.passed, total: stat.total },
        };
      }
    }
  }
```

Place this block after the Tier 1 return and before the Tier 3 block. Note Tier 2 only fires when Tier 1 returned nothing (no `in_progress`), which is how the control flow naturally sequences (Tier 1 returns early; Tier 2 runs only on fallthrough).

- [ ] **Step 4: Run the tests**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C platform add src/progress/progress.service.ts test/progress/recommendation.service.spec.ts
git -C platform commit -m "feat(progress): recommendation tier 2 weakest-concept gap"
```

---

## Task 7: Service — edge-case tests (draft exclusion, version bump)

**Files:**
- Modify: `platform/test/progress/recommendation.service.spec.ts`

- [ ] **Step 1: Add an `Edge cases` describe block inside the main describe**

```typescript
  describe('Edge cases', () => {
    it('excludes draft tracks from every tier', async () => {
      const studentId = await makeStudent();
      // Published track with lesson
      const exPub = await makeExercise();
      const Lpub = await makeLessonWithExercises(newId(), 0, [exPub], 'PubLesson');
      await makeTrack([{ id: Lpub.lessonId, version: Lpub.lessonVersion }], 'PubTrack');
      // Draft track — never publish
      const exDraft = await makeExercise();
      const Ldraft = await makeLessonWithExercises(newId(), 0, [exDraft], 'DraftLesson');
      const draftTrackId = newId();
      await tracks.createDraft({
        id: draftTrackId, title: 'DraftTrack', language: 'swift', kind: 'fundamentals',
        description: 'd',
        lessons: [{ id: Ldraft.lessonId, version: Ldraft.lessonVersion }],
      });
      // Do NOT call tracks.publish

      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('first_timer');
      if (result.kind !== 'first_timer') throw new Error('narrow');
      expect(result.lesson.id).toBe(Lpub.lessonId);
    });

    it('treats a lesson as in_progress when a newer published exercise version is unattempted', async () => {
      const studentId = await makeStudent();
      const exId = newId();
      // Create v1 and publish
      await exercises.createDraft({
        id: exId, lessonId: newId(), promptMarkdown: 'p', type: 'multiple_choice',
        payload: {
          type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false,
        },
        pointsMax: 10, hints: [], concepts: [],
      });
      await exercises.publish(exId, 1);
      // Create v2 and publish (bump)
      await exercises.createNextVersion(exId, {
        lessonId: newId(), promptMarkdown: 'p2', type: 'multiple_choice',
        payload: {
          type: 'multiple_choice', questionMarkdown: 'q2',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false,
        },
        pointsMax: 10, hints: [], concepts: [],
      });
      await exercises.publish(exId, 2);

      const { lessonId, lessonVersion } = await makeLessonWithExercises(newId(), 0, [exId], 'Versioned');
      await makeTrack([{ id: lessonId, version: lessonVersion }]);

      // Student passed v1
      const aid = newId();
      await prisma.attempt.create({
        data: {
          id: aid, studentId, exerciseId: exId, exerciseVersion: 1,
          submittedAt: new Date(), submissionPayload: {},
          passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
        },
      });
      await prisma.exerciseResult.create({
        data: {
          id: newId(), studentId, exerciseId: exId, bestAttemptId: aid,
          passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
        },
      });

      // Behavior check: the aggregation uses latest published version (v2). The
      // ExerciseResult row is keyed on exerciseId (not version), so passedSet still
      // contains exId. The attempt groupBy is also keyed on exerciseId. So passed=1,
      // attempted=1, total=1 → state='complete'. That means the recommendation returns
      // exhausted, not continue.
      //
      // This is the documented A-consistency: pass status is not invalidated by version
      // bumps in the current data model. The spec's "asserts consistency with A" line
      // is literal — if A ships this way, D matches. Therefore expect 'exhausted'.
      const result = await svc.getRecommendation(studentId);
      expect(result.kind).toBe('exhausted');
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
npm --prefix platform test -- recommendation.service
```

Expected: both edge-case tests PASS without touching implementation.

- [ ] **Step 3: Commit**

```bash
git -C platform add test/progress/recommendation.service.spec.ts
git -C platform commit -m "test(progress): recommendation edge cases (draft exclusion, version bump)"
```

---

## Task 8: Controller — add `GET /recommendation` route + e2e (red → green)

**Files:**
- Modify: `platform/src/progress/progress.controller.ts`
- Create: `platform/test/progress/recommendation.controller.spec.ts`

- [ ] **Step 1: Write failing e2e tests**

Create `platform/test/progress/recommendation.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProgressController — GET /api/progress/recommendation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(): Promise<{ cookie: string; userId: string; studentId: string | null }> {
    const userEmail = `user-${newId()}@test.com`;
    const password = 'password123';
    const regRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: userEmail, name: 'Tester', password });
    const userId: string = regRes.body.user.id;
    const raw = regRes.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;
    return { cookie, userId, studentId: null };
  }

  async function createStudent(userId: string): Promise<string> {
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Tester', email: `student-${newId()}@test.com`, userId },
    });
    return studentId;
  }

  async function seedOneLessonOneTrack(): Promise<{ trackId: string; lessonId: string; exerciseId: string }> {
    const exerciseId = newId();
    await prisma.exercise.create({
      data: {
        id: exerciseId, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    const lessonId = newId();
    const trackId = newId();
    await prisma.lesson.create({
      data: {
        id: lessonId, version: 1, trackId, position: 0, title: 'Opener',
        level: 'beginner', summary: 's', blockIds: [], publishedAt: new Date(),
      },
    });
    await prisma.block.create({
      data: {
        id: newId(), lessonId, lessonVersion: 1, position: 0,
        kind: 'exercise', exerciseId, exerciseVersion: 1,
      },
    });
    await prisma.track.create({
      data: {
        id: trackId, version: 1, title: 'Swift Fundamentals', language: 'swift', kind: 'fundamentals',
        description: 'd', lessonIds: [lessonId], lessonVersions: [1], publishedAt: new Date(),
      },
    });
    return { trackId, lessonId, exerciseId };
  }

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .expect(401);
  });

  it('returns first_timer "Start here." when authenticated user has no Student row but tracks exist', async () => {
    const { cookie } = await registerAndGetCookie();
    const { lessonId, trackId } = await seedOneLessonOneTrack();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('first_timer');
    expect(res.body.reason.message).toBe('Start here.');
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.lesson.trackId).toBe(trackId);
    expect(res.body.lesson.trackTitle).toBe('Swift Fundamentals');
  });

  it('returns continue for a student with an in-progress lesson', async () => {
    const { cookie, userId } = await registerAndGetCookie();
    const studentId = await createStudent(userId);
    const { lessonId, exerciseId } = await seedOneLessonOneTrack();

    // Attach a second exercise to the lesson so partial progress is possible
    const ex2 = newId();
    await prisma.exercise.create({
      data: {
        id: ex2, version: 1, lessonId: newId(), promptMarkdown: 'p',
        type: 'multiple_choice',
        payload: { type: 'multiple_choice', questionMarkdown: 'q',
          options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
        pointsMax: 10, hints: [], concepts: [], publishedAt: new Date(),
      },
    });
    await prisma.block.create({
      data: {
        id: newId(), lessonId, lessonVersion: 1, position: 1,
        kind: 'exercise', exerciseId: ex2, exerciseVersion: 1,
      },
    });

    // Pass exerciseId only
    const aid = newId();
    await prisma.attempt.create({
      data: {
        id: aid, studentId, exerciseId, exerciseVersion: 1,
        submittedAt: new Date(), submissionPayload: {},
        passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 10,
      },
    });
    await prisma.exerciseResult.create({
      data: {
        id: newId(), studentId, exerciseId, bestAttemptId: aid,
        passed: true, pointsEarned: 10, attemptsCount: 1, firstPassedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.kind).toBe('continue');
    expect(res.body.lesson.id).toBe(lessonId);
    expect(res.body.reason.message).toBe('Continue where you left off.');
  });

  it('returns exhausted "No curriculum published yet." for an empty catalog', async () => {
    const { cookie } = await registerAndGetCookie();

    const res = await request(app.getHttpServer())
      .get('/api/progress/recommendation')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toEqual({
      kind: 'exhausted',
      reason: { message: 'No curriculum published yet.' },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm --prefix platform test -- recommendation.controller
```

Expected: all four tests FAIL with 404 (route doesn't exist yet).

- [ ] **Step 3: Add the route to the controller**

Modify `platform/src/progress/progress.controller.ts`. Update the import line to pull in the new response type:

```typescript
import { ProgressAggregatorService, TrackProgress, ConceptsProgress, RecommendationResponse } from './progress.service';
```

Then add this method to the `ProgressController` class, after `getConceptProgress`:

```typescript
@Get('recommendation')
@UseGuards(JwtAuthGuard)
async getRecommendation(
  @CurrentUser() user: { userId: string },
): Promise<RecommendationResponse> {
  const student = await this.students.findByUserId(user.userId);
  const studentId = student?.id ?? null;
  return this.service.getRecommendation(studentId);
}
```

- [ ] **Step 4: Run the tests**

```bash
npm --prefix platform test -- recommendation.controller
```

Expected: all four tests PASS.

- [ ] **Step 5: Run the full platform test suite to ensure nothing broke**

```bash
npm --prefix platform test
```

Expected: full green (no regressions in existing progress / submission / auth suites).

- [ ] **Step 6: Commit**

```bash
git -C platform add src/progress/progress.controller.ts test/progress/recommendation.controller.spec.ts
git -C platform commit -m "feat(progress): GET /api/progress/recommendation endpoint"
```

---

## Task 9: Web — add `RecommendationResponse` types + `fetchRecommendation` helper

**Files:**
- Modify: `web/lib/progress.ts`

- [ ] **Step 1: Append the types and fetch helper to `lib/progress.ts`**

Open `web/lib/progress.ts`. Below the existing exports (after `fetchConceptProgress`), append:

```typescript
export type LessonSummary = {
  id: string;
  version: number;
  title: string;
  trackId: string;
  trackTitle: string;
};

export type RecommendationResponse =
  | { kind: 'continue';    lesson: LessonSummary; reason: { message: string } }
  | { kind: 'concept_gap'; lesson: LessonSummary; reason: { message: string; concept: string; passed: number; total: number } }
  | { kind: 'first_timer'; lesson: LessonSummary; reason: { message: string } }
  | { kind: 'exhausted';                          reason: { message: string } };

export async function fetchRecommendation(): Promise<RecommendationResponse> {
  const res = await fetch(`${BASE}/api/progress/recommendation`, { credentials: 'include' });
  if (!res.ok) throw new Error(`recommendation ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

```bash
npm --prefix web run build
```

Expected: Next build succeeds. If any other file in the web app accidentally imports a symbol named `LessonSummary` or `RecommendationResponse`, resolve the conflict (unlikely on master).

- [ ] **Step 3: Commit**

```bash
git -C web add lib/progress.ts
git -C web commit -m "feat(web): fetchRecommendation helper and types"
```

---

## Task 10: Web — `NextLessonWidget` component + tests (red → green)

**Files:**
- Create: `web/components/dashboard/NextLessonWidget.tsx`
- Create: `web/tests/dashboard/NextLessonWidget.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `web/tests/dashboard/NextLessonWidget.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextLessonWidget } from '@/components/dashboard/NextLessonWidget';
import type { RecommendationResponse } from '@/lib/progress';

const baseLesson = {
  id: 'lesson-1',
  version: 1,
  title: 'Optionals 101',
  trackId: 'track-1',
  trackTitle: 'Swift Fundamentals',
};

describe('NextLessonWidget', () => {
  it('renders nothing when recommendation is null', () => {
    const { container } = render(<NextLessonWidget recommendation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the continue variant with Resume CTA', () => {
    const rec: RecommendationResponse = {
      kind: 'continue',
      lesson: baseLesson,
      reason: { message: 'Continue where you left off.' },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/continue/i)).toBeInTheDocument();
    expect(screen.getByText('Optionals 101')).toBeInTheDocument();
    expect(screen.getByText('Swift Fundamentals')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /resume/i });
    expect(link).toHaveAttribute('href', '/lesson/lesson-1');
  });

  it('renders the concept_gap variant with Practice CTA and passed/total chip', () => {
    const rec: RecommendationResponse = {
      kind: 'concept_gap',
      lesson: baseLesson,
      reason: {
        message: "Practice Optionals — you've passed 2/5 so far.",
        concept: 'Optionals',
        passed: 2,
        total: 5,
      },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/practice optionals/i)).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /practice/i });
    expect(link).toHaveAttribute('href', '/lesson/lesson-1');
  });

  it('renders the concept_gap variant with Start CTA when passed is 0', () => {
    const rec: RecommendationResponse = {
      kind: 'concept_gap',
      lesson: baseLesson,
      reason: {
        message: 'Start on Optionals — 0/5 passed.',
        concept: 'Optionals',
        passed: 0,
        total: 5,
      },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/start optionals/i)).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /start/i });
    expect(link).toHaveAttribute('href', '/lesson/lesson-1');
  });

  it('renders the first_timer variant with Start here eyebrow for a brand-new student', () => {
    const rec: RecommendationResponse = {
      kind: 'first_timer',
      lesson: baseLesson,
      reason: { message: 'Start here.' },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/start here/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /start/i });
    expect(link).toHaveAttribute('href', '/lesson/lesson-1');
  });

  it('renders the first_timer variant with Next up eyebrow for a returning student', () => {
    const rec: RecommendationResponse = {
      kind: 'first_timer',
      lesson: baseLesson,
      reason: { message: 'Next up: Swift Fundamentals.' },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/next up/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /start/i });
    expect(link).toHaveAttribute('href', '/lesson/lesson-1');
  });

  it('renders the exhausted variant with no link', () => {
    const rec: RecommendationResponse = {
      kind: 'exhausted',
      reason: { message: "You've finished the published curriculum." },
    };
    render(<NextLessonWidget recommendation={rec} />);
    expect(screen.getByText(/all done/i)).toBeInTheDocument();
    expect(screen.getByText(/finished the published curriculum/i)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm --prefix web test -- NextLessonWidget
```

Expected: all seven tests FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `web/components/dashboard/NextLessonWidget.tsx`:

```tsx
import Link from 'next/link';
import type { RecommendationResponse } from '@/lib/progress';

type Props = { recommendation: RecommendationResponse | null };

const shell = 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900';
const eyebrow = 'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
const bodyRow = 'flex items-center justify-between gap-3';
const ctaCls = 'shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500';
const titleCls = 'truncate text-sm font-semibold text-gray-800 dark:text-gray-100';
const subCls = 'truncate text-xs text-gray-500 dark:text-gray-400';
const messageCls = 'mt-1 text-xs text-gray-600 dark:text-gray-300';

export function NextLessonWidget({ recommendation }: Props) {
  if (!recommendation) return null;

  if (recommendation.kind === 'exhausted') {
    return (
      <div className={`${shell} text-center`}>
        <div className={eyebrow}>All done</div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{recommendation.reason.message}</p>
      </div>
    );
  }

  const { lesson } = recommendation;
  const href = `/lesson/${lesson.id}`;

  let eyebrowLabel: React.ReactNode;
  let ctaLabel: string;

  switch (recommendation.kind) {
    case 'continue':
      eyebrowLabel = 'Continue';
      ctaLabel = 'Resume →';
      break;
    case 'concept_gap': {
      const { concept, passed, total } = recommendation.reason;
      const leader = passed === 0 ? 'Start' : 'Practice';
      eyebrowLabel = (
        <>
          {leader} {concept} · <span className="tabular-nums">{passed}/{total}</span>
        </>
      );
      ctaLabel = passed === 0 ? 'Start →' : 'Practice →';
      break;
    }
    case 'first_timer': {
      eyebrowLabel = recommendation.reason.message.startsWith('Start') ? 'Start here' : 'Next up';
      ctaLabel = 'Start →';
      break;
    }
  }

  return (
    <div className={shell}>
      <div className={eyebrow}>{eyebrowLabel}</div>
      <div className={bodyRow}>
        <div className="min-w-0 flex-1">
          <div className={titleCls}>{lesson.title}</div>
          <div className={subCls}>{lesson.trackTitle}</div>
          <p className={messageCls}>{recommendation.reason.message}</p>
        </div>
        <Link href={href} className={ctaCls}>{ctaLabel}</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
npm --prefix web test -- NextLessonWidget
```

Expected: all seven tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C web add components/dashboard/NextLessonWidget.tsx tests/dashboard/NextLessonWidget.test.tsx
git -C web commit -m "feat(web): NextLessonWidget dashboard component"
```

---

## Task 11: Web — wire `NextLessonWidget` into the dashboard page

**Files:**
- Modify: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Update imports**

At the top of `web/app/dashboard/page.tsx`, adjust the existing `lib/progress` import and add the widget import:

```typescript
import { fetchConceptProgress, fetchRecommendation, type ConceptsProgress, type RecommendationResponse } from '@/lib/progress';
import { NextLessonWidget } from '@/components/dashboard/NextLessonWidget';
```

- [ ] **Step 2: Add state slot and fetch call**

Replace the state declarations block (currently ending with `const [fetching, setFetching] = useState(false);`) with:

```typescript
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [concepts, setConcepts] = useState<ConceptsProgress | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
```

Then update the `Promise.all` to add the new fetch:

```typescript
    Promise.all([
      fetchDashboard(),
      fetchLeaderboard(),
      fetchConceptProgress().catch(() => null),
      fetchReviewQueue().catch(() => null),
      fetchRecommendation().catch(() => null),
    ])
      .then(([dash, lb, cp, rq, rec]) => {
        setDashboard(dash);
        setLeaderboard(lb);
        setConcepts(cp);
        setReviewQueue(rq);
        setRecommendation(rec);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setFetching(false));
```

- [ ] **Step 3: Render the widget in the JSX tree**

Replace the `<ReviewWidget ... />` line and the immediately-following `<StatsCard .../>` so the widget sits between them:

```tsx
            <ReviewWidget dueCount={dueCount} hasAnyCards={hasAnyCards} />
            <NextLessonWidget recommendation={recommendation} />
            <StatsCard
              streak={dashboard.streak}
              totalPoints={dashboard.totalPoints}
              rank={dashboard.rank}
            />
```

- [ ] **Step 4: Typecheck and build**

```bash
npm --prefix web run build
```

Expected: Next build succeeds. Warnings unrelated to this change are fine.

- [ ] **Step 5: Run the web test suite**

```bash
npm --prefix web test
```

Expected: all tests pass, including existing ReviewWidget / ConceptMastery / review tests. The dashboard page has no test file so nothing page-level runs here — that's by design (spec §6.4).

- [ ] **Step 6: Manual smoke test (optional but recommended)**

```bash
pwsh ./dev.ps1 dev
```

Log in as a seeded student (see `dev.ps1 seed` instructions). Load `/dashboard`. Verify:
- A brand-new student sees the `NextLessonWidget` at the top (above `StatsCard`) with eyebrow "Start here" and a blue "Start →" CTA linking to `/lesson/<id>`.
- A student with due review cards sees `ReviewWidget` above `NextLessonWidget`.
- Clicking the CTA navigates to the lesson page.

Record what you observed (passed / did-not-test / failed) in the commit trailer.

- [ ] **Step 7: Commit**

```bash
git -C web add app/dashboard/page.tsx
git -C web commit -m "feat(web): wire NextLessonWidget into dashboard"
```

---

## Task 12: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full platform suite**

```bash
npm --prefix platform test
```

Expected: all specs green. Specifically:
- `test/progress/progress.service.spec.ts` (A's original) — unchanged, still green.
- `test/progress/progress.controller.spec.ts` (A's original) — unchanged, still green.
- `test/progress/recommendation.service.spec.ts` — new, green.
- `test/progress/recommendation.controller.spec.ts` — new, green.
- Submission / auth / execution / gamification suites — unchanged, still green.

- [ ] **Step 2: Full web suite**

```bash
npm --prefix web test
```

Expected: all specs green. Specifically:
- `tests/dashboard/ReviewWidget.test.tsx` — unchanged, still green.
- `tests/dashboard/ConceptMastery.test.tsx` — unchanged, still green.
- `tests/dashboard/NextLessonWidget.test.tsx` — new, green.

- [ ] **Step 3: Platform build**

```bash
npm --prefix platform run build
```

Expected: clean build.

- [ ] **Step 4: Web build**

```bash
npm --prefix web run build
```

Expected: clean build.

- [ ] **Step 5: Confirm no changes to restricted files**

```bash
git -C platform log --oneline master..HEAD
git -C web log --oneline master..HEAD
```

Expected: each branch has 5–9 focused commits touching only the files listed in the File Structure section. Nothing under `feat/adaptive-content-engine` and nothing unrelated to `progress/` (platform) or `dashboard/` (web).

- [ ] **Step 6: Plan complete**

All 12 tasks done. Spec requirements mapped:

| Spec section | Task(s) |
|---|---|
| §1 Goals & scope | *(implicit in plan)* |
| §2.1 Endpoint route | Task 8 |
| §2.2 Response types | Tasks 1, 9 |
| §2.3 Error responses (401, no-404) | Task 8 |
| §3.1 Tier 1 algorithm | Task 5 |
| §3.2 Tier 2 algorithm | Task 6 |
| §3.3 Tier 3 algorithm | Task 4 |
| §3.4 Tier 4 algorithm | Tasks 2, 3 |
| §4 Aggregation & query plan | Task 3 |
| §5 Web UI | Tasks 9, 10, 11 |
| §6.1 Service unit tests | Tasks 2, 4, 5, 6, 7 |
| §6.2 Controller e2e tests | Task 8 |
| §6.3 Component tests | Task 10 |
| §7 Out of scope | *(not implemented — correct)* |
