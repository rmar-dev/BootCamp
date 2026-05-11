# Dashboard Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the design's `/dashboard` (daily strip + Up next + paths + mini leaderboard) into the live app, backed by a single extended `GET /api/dashboard/me` payload, with `TrackContext` lifted to make the chrome's Swift/Kotlin segmented control functional. Spans two repos: `platform/` (NestJS, ships first) and `web/` (Next.js, ships second).

**Architecture:** Two worktrees, two branches, two PRs in strict order. Phase 1 extends platform's `DashboardResponse` with `todayPlan`, `dailyXp`, `mastery`, `streakIncrementedToday`, `pointsEarnedToday` and adds `?trackId=` filtering. Phase 2 introduces a `TrackProvider` in the route-group layout, ports the design's `app.css` slice, builds 7 new dashboard components from existing primitives, and deletes 5 obsolete ones. TDD per file, one commit per task.

**Tech Stack:** NestJS 10 + Prisma 5 + Jest + Postgres on platform; Next.js 14 App Router + React 18 + Tailwind + Vitest + Playwright on web; design tokens + class-based primitives shared via `@/components/ui` (Sub-project A) and chrome via `(authed)/layout.tsx` (Sub-project B).

**Spec:** `docs/superpowers/specs/2026-05-02-dashboard-design.md`

---

## File Structure

### `platform/` (created/modified)

| File | Status | Responsibility |
|---|---|---|
| `src/gamification/mastery.service.ts` | NEW | Pure: triangular XP curve, level/xpInLevel/xpForNextLevel computation |
| `src/content/services/lesson-insight.service.ts` | NEW | Pure: estimateMinutes, deriveTypeLabel from exercises |
| `src/gamification/daily-xp.service.ts` | NEW | Wraps repo `sumPointsSince`; exports `DAILY_XP_TARGET = 20` |
| `src/gamification/today-plan.service.ts` | NEW | Composes recommendation + position lookup + insight to build TodayPlan |
| `src/gamification/streak.service.ts` | MODIFY | Extend `StreakResult` with `incrementedToday: boolean` |
| `src/state/repositories/exercise-result.repository.ts` | MODIFY | Add `sumPointsSince(studentId, sinceUtc)` |
| `src/progress/progress.service.ts` | MODIFY | `getRecommendation(studentId, trackId?)` |
| `src/progress/progress.controller.ts` | MODIFY | Accept `?trackId=` query param |
| `src/gamification/dashboard.controller.ts` | MODIFY | Extend payload + parallel service calls |
| `src/gamification/gamification.module.ts` | MODIFY | Register `MasteryService`, `DailyXpService`, `TodayPlanService` |
| `src/content/content.module.ts` | MODIFY | Export `LessonInsightService` |
| `test/gamification/mastery.service.spec.ts` | NEW | Boundary table for level math |
| `test/content/lesson-insight.service.spec.ts` | NEW | Per-type duration + label derivation |
| `test/gamification/daily-xp.service.spec.ts` | NEW | UTC-day window assertions |
| `test/gamification/today-plan.service.spec.ts` | NEW | Each kind, exhausted, trackId mismatch |
| `test/state/exercise-result.repository.spec.ts` | NEW | sumPointsSince boundary |
| `test/gamification/streak.service.spec.ts` | MODIFY | Assert `incrementedToday` |
| `test/gamification/dashboard.controller.spec.ts` | MODIFY | New shape + ?trackId= filter |

### `web/` (created/modified/deleted)

| File | Status | Responsibility |
|---|---|---|
| `styles/app.css` | MODIFY | Populate with shell + dashboard CSS slice from design |
| `lib/__fixtures__/dashboard.fixture.ts` | NEW | Sample DashboardResponse shapes (continue + exhausted) |
| `lib/track-context.tsx` | NEW | TrackProvider + useActiveTrack hook + storage |
| `lib/gamification.ts` | MODIFY | Widen `DashboardData`; `fetchDashboard(trackId?)` |
| `app/(authed)/layout.tsx` | MODIFY | Wrap children in `<TrackProvider>` |
| `app/(authed)/dashboard/page.tsx` | MODIFY | Refactor to new composition; drop AppShell shim |
| `components/shell/Topbar.tsx` | MODIFY | SegmentedControl consumes `useActiveTrack` |
| `components/shell/ActiveTrackPill.tsx` | MODIFY | Consumes `useActiveTrack` |
| `components/dashboard/PageHead.tsx` | NEW | Eyebrow + Heading + nudge + actions |
| `components/dashboard/DailyStrip.tsx` | NEW | Hero + 3 KPIs |
| `components/dashboard/LessonRow.tsx` | NEW | Shared row primitive |
| `components/dashboard/UpNextList.tsx` | NEW | First 4 not-complete lessons |
| `components/dashboard/RecentlyCompletedList.tsx` | NEW | Last 3 completed |
| `components/dashboard/PathsList.tsx` | NEW | Per-track progress cards |
| `components/dashboard/MiniLeaderboard.tsx` | NEW | Top 3 + you |
| `components/dashboard/DashboardSkeleton.tsx` | NEW | Loading state |
| `components/dashboard/DashboardError.tsx` | NEW | Error state with retry |
| `components/dashboard/StatsCard.tsx` | DELETE | Superseded by DailyStrip KPIs |
| `components/dashboard/BadgesGrid.tsx` | DELETE | Moves to /profile in Sub-project F |
| `components/dashboard/ConceptMastery.tsx` | DELETE | Moves to /profile in Sub-project F |
| `components/dashboard/ReviewWidget.tsx` | DELETE | Sidebar badge already surfaces this |
| `components/dashboard/LeaderboardTable.tsx` | DELETE | Replaced by MiniLeaderboard |
| `tests/lib/track-context.test.tsx` | NEW | Hook contract |
| `tests/dashboard/{LessonRow,DailyStrip,UpNextList,RecentlyCompletedList,PathsList,MiniLeaderboard,PageHead}.test.tsx` | NEW | Per-component |
| `tests/dashboard/page.test.tsx` | NEW | Orchestrator |
| `tests/shell/Topbar.test.tsx` + `tests/shell/ActiveTrackPill.test.tsx` | MODIFY | Consume TrackContext |
| `tests/dashboard/{ReviewWidget,ConceptMastery,BadgesGrid,StatsCard,LeaderboardTable}.test.tsx` | DELETE | Components retired |
| `tests/e2e/dashboard.spec.ts` | NEW | Playwright smoke |

---

## Repository Setup (do once before Phase 1)

### Task R0: Create both worktrees and branches

**Files:** none yet — bootstrap only.

- [ ] **Step 1: Create platform worktree**

```bash
cd c:/Users/ricma/BootCamp/platform
git fetch origin
git worktree add c:/tmp/bootcamp-platform-dashboard -b feat/dashboard-payload master
```

Expected: new worktree at `c:/tmp/bootcamp-platform-dashboard` on branch `feat/dashboard-payload`.

- [ ] **Step 2: Create web worktree**

```bash
cd c:/Users/ricma/BootCamp/web
git fetch origin
git worktree add c:/tmp/bootcamp-web-dashboard -b feat/dashboard master
```

Expected: new worktree at `c:/tmp/bootcamp-web-dashboard` on branch `feat/dashboard`.

- [ ] **Step 3: Verify both branches**

```bash
cd c:/tmp/bootcamp-platform-dashboard && git branch --show-current
cd c:/tmp/bootcamp-web-dashboard && git branch --show-current
```

Expected: `feat/dashboard-payload` and `feat/dashboard` respectively.

- [ ] **Step 4: Install deps in both worktrees**

```bash
cd c:/tmp/bootcamp-platform-dashboard && npm install
cd c:/tmp/bootcamp-web-dashboard && npm install
```

Expected: both `npm install` succeed; no commit (lockfile already present).

---

## Phase 1 — `platform/` (`feat/dashboard-payload` worktree)

All Phase 1 tasks run in `c:/tmp/bootcamp-platform-dashboard`.

### Task P1: `MasteryService` — pure level math

**Files:**
- Create: `src/gamification/mastery.service.ts`
- Test: `test/gamification/mastery.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/gamification/mastery.service.spec.ts`:

```ts
import { MasteryService } from '../../src/gamification/mastery.service';

describe('MasteryService', () => {
  const svc = new MasteryService();

  describe('compute', () => {
    it.each([
      [0,    1, 0,    100],
      [99,   1, 99,   1],
      [100,  2, 0,    200],
      [299,  2, 199,  1],
      [300,  3, 0,    300],
      [599,  3, 299,  1],
      [600,  4, 0,    400],
      [999,  4, 399,  1],
      [1000, 5, 0,    500],
      [1499, 5, 499,  1],
      [1500, 6, 0,    600],
    ])(
      'totalPoints=%i → level=%i, xpInLevel=%i, xpForNextLevel=%i',
      (totalPoints, level, xpInLevel, xpForNextLevel) => {
        expect(svc.compute(totalPoints)).toEqual({ level, xpInLevel, xpForNextLevel });
      },
    );

    it('handles totalPoints far above the table (extrapolates)', () => {
      const r = svc.compute(10_000);
      expect(r.level).toBeGreaterThan(10);
      expect(r.xpInLevel).toBeGreaterThanOrEqual(0);
      expect(r.xpForNextLevel).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=mastery.service.spec
```

Expected: FAIL with `Cannot find module '../../src/gamification/mastery.service'`.

- [ ] **Step 3: Create the service**

Create `src/gamification/mastery.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

export type MasteryProgress = {
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
};

@Injectable()
export class MasteryService {
  /** Triangular cumulative: sum of 100, 200, 300, ... for the first L-1 levels. */
  static xpForLevelStart(level: number): number {
    return (100 * level * (level - 1)) / 2;
  }

  compute(totalPoints: number): MasteryProgress {
    const safe = Math.max(0, Math.floor(totalPoints));
    let level = 1;
    while (MasteryService.xpForLevelStart(level + 1) <= safe) level++;
    const xpInLevel = safe - MasteryService.xpForLevelStart(level);
    const xpForNextLevel = MasteryService.xpForLevelStart(level + 1) - safe;
    return { level, xpInLevel, xpForNextLevel };
  }
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=mastery.service.spec
```

Expected: PASS, all 12 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/gamification/mastery.service.ts test/gamification/mastery.service.spec.ts
git commit -m "feat(gamification): MasteryService with triangular XP curve"
```

---

### Task P2: `LessonInsightService` — duration + type label

**Files:**
- Create: `src/content/services/lesson-insight.service.ts`
- Test: `test/content/lesson-insight.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/content/lesson-insight.service.spec.ts`:

```ts
import { LessonInsightService, ExerciseLike } from '../../src/content/services/lesson-insight.service';

const ex = (type: ExerciseLike['type']): ExerciseLike => ({ type });

describe('LessonInsightService', () => {
  const svc = new LessonInsightService();

  describe('estimateMinutes', () => {
    it('returns 1 minute for empty input', () => {
      expect(svc.estimateMinutes([])).toBe(1);
    });
    it('per-type seconds → ceil minutes', () => {
      expect(svc.estimateMinutes([ex('multiple_choice')])).toBe(1);   // 30s → 1
      expect(svc.estimateMinutes([ex('fill_blank')])).toBe(1);        // 60s → 1
      expect(svc.estimateMinutes([ex('predict_output')])).toBe(2);    // 90s → 2
      expect(svc.estimateMinutes([ex('code')])).toBe(4);              // 240s → 4
      expect(svc.estimateMinutes([ex('fix_bug')])).toBe(4);
      expect(svc.estimateMinutes([ex('capstone_submission')])).toBe(20);
    });
    it('sums and ceils mixed lessons', () => {
      // 30 + 60 + 240 = 330s = 5.5 → 6 min
      const lesson = [ex('multiple_choice'), ex('fill_blank'), ex('code')];
      expect(svc.estimateMinutes(lesson)).toBe(6);
    });
  });

  describe('deriveTypeLabel', () => {
    it('empty → Concept + quiz (degenerate default)', () => {
      expect(svc.deriveTypeLabel([])).toBe('Concept + quiz');
    });
    it('only quiz/predict → Concept + quiz', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('predict_output')])).toBe('Concept + quiz');
    });
    it('only code/fix-bug → Code + tests', () => {
      expect(svc.deriveTypeLabel([ex('code'), ex('fix_bug')])).toBe('Code + tests');
    });
    it('mixed quiz + code → Concept + code', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('code')])).toBe('Concept + code');
    });
    it('any capstone present → Capstone', () => {
      expect(svc.deriveTypeLabel([ex('multiple_choice'), ex('capstone_submission')])).toBe('Capstone');
    });
    it('fill_blank groups with quiz side', () => {
      expect(svc.deriveTypeLabel([ex('fill_blank')])).toBe('Concept + quiz');
      expect(svc.deriveTypeLabel([ex('fill_blank'), ex('code')])).toBe('Concept + code');
    });
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=lesson-insight.service.spec
```

Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the service**

Create `src/content/services/lesson-insight.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ExerciseType } from '@prisma/client';

export type ExerciseLike = { type: ExerciseType };
export type TypeLabel = 'Concept + quiz' | 'Code + tests' | 'Concept + code' | 'Capstone';

const SECONDS_BY_TYPE: Record<ExerciseType, number> = {
  multiple_choice: 30,
  fill_blank: 60,
  predict_output: 90,
  code: 240,
  fix_bug: 240,
  capstone_submission: 1200,
};

const QUIZ_TYPES = new Set<ExerciseType>(['multiple_choice', 'fill_blank', 'predict_output']);
const CODE_TYPES = new Set<ExerciseType>(['code', 'fix_bug']);

@Injectable()
export class LessonInsightService {
  estimateMinutes(exercises: ExerciseLike[]): number {
    if (exercises.length === 0) return 1;
    const totalSeconds = exercises.reduce((acc, e) => acc + SECONDS_BY_TYPE[e.type], 0);
    return Math.max(1, Math.ceil(totalSeconds / 60));
  }

  deriveTypeLabel(exercises: ExerciseLike[]): TypeLabel {
    if (exercises.length === 0) return 'Concept + quiz';
    if (exercises.some((e) => e.type === 'capstone_submission')) return 'Capstone';
    const hasQuiz = exercises.some((e) => QUIZ_TYPES.has(e.type));
    const hasCode = exercises.some((e) => CODE_TYPES.has(e.type));
    if (hasQuiz && hasCode) return 'Concept + code';
    if (hasCode) return 'Code + tests';
    return 'Concept + quiz';
  }
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=lesson-insight.service.spec
```

Expected: PASS.

- [ ] **Step 5: Register in `ContentModule` providers + exports**

Edit `src/content/content.module.ts`. Find the providers/exports arrays. Add `LessonInsightService` to both:

```ts
import { LessonInsightService } from './services/lesson-insight.service';
// ...
providers: [..., LessonInsightService],
exports: [..., LessonInsightService],
```

- [ ] **Step 6: Verify the module compiles**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/content/services/lesson-insight.service.ts test/content/lesson-insight.service.spec.ts src/content/content.module.ts
git commit -m "feat(content): LessonInsightService for duration + type-label derivation"
```

---

### Task P3: `ExerciseResultRepository.sumPointsSince`

**Files:**
- Modify: `src/state/repositories/exercise-result.repository.ts`
- Test: `test/state/exercise-result.repository.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/state/exercise-result.repository.spec.ts`:

```ts
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';

describe('ExerciseResultRepository.sumPointsSince', () => {
  let repo: ExerciseResultRepository;
  const aggregate = jest.fn();
  const mockPrisma = { exerciseResult: { aggregate } } as any;

  beforeEach(() => {
    aggregate.mockReset();
    repo = new ExerciseResultRepository(mockPrisma);
  });

  it('returns 0 when no rows match', async () => {
    aggregate.mockResolvedValueOnce({ _sum: { pointsEarned: null } });
    const since = new Date('2026-05-02T00:00:00Z');
    const r = await repo.sumPointsSince('student-1', since);
    expect(r).toBe(0);
    expect(aggregate).toHaveBeenCalledWith({
      where: { studentId: 'student-1', updatedAt: { gte: since } },
      _sum: { pointsEarned: true },
    });
  });

  it('returns the sum when rows match', async () => {
    aggregate.mockResolvedValueOnce({ _sum: { pointsEarned: 42 } });
    const r = await repo.sumPointsSince('student-1', new Date('2026-05-02T00:00:00Z'));
    expect(r).toBe(42);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=exercise-result.repository.spec
```

Expected: FAIL with `repo.sumPointsSince is not a function`.

- [ ] **Step 3: Add the method**

Edit `src/state/repositories/exercise-result.repository.ts`. Add this method inside the class:

```ts
async sumPointsSince(studentId: string, sinceUtc: Date): Promise<number> {
  const agg = await this.prisma.exerciseResult.aggregate({
    where: { studentId, updatedAt: { gte: sinceUtc } },
    _sum: { pointsEarned: true },
  });
  return agg._sum.pointsEarned ?? 0;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=exercise-result.repository.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/repositories/exercise-result.repository.ts test/state/exercise-result.repository.spec.ts
git commit -m "feat(state): ExerciseResultRepository.sumPointsSince for daily-XP queries"
```

---

### Task P4: `DailyXpService`

**Files:**
- Create: `src/gamification/daily-xp.service.ts`
- Test: `test/gamification/daily-xp.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/gamification/daily-xp.service.spec.ts`:

```ts
import { DailyXpService, DAILY_XP_TARGET } from '../../src/gamification/daily-xp.service';
import { ExerciseResultRepository } from '../../src/state/repositories/exercise-result.repository';

describe('DailyXpService', () => {
  let svc: DailyXpService;
  let repo: jest.Mocked<Pick<ExerciseResultRepository, 'sumPointsSince'>>;

  beforeEach(() => {
    repo = { sumPointsSince: jest.fn() };
    svc = new DailyXpService(repo as unknown as ExerciseResultRepository);
  });

  it('exports DAILY_XP_TARGET = 20', () => {
    expect(DAILY_XP_TARGET).toBe(20);
  });

  it('queries with UTC startOfDay and returns { earned, target }', async () => {
    repo.sumPointsSince.mockResolvedValueOnce(15);
    const r = await svc.compute('student-1');
    expect(r).toEqual({ earned: 15, target: 20 });

    const callArg = repo.sumPointsSince.mock.calls[0][1];
    expect(callArg.getUTCHours()).toBe(0);
    expect(callArg.getUTCMinutes()).toBe(0);
    expect(callArg.getUTCSeconds()).toBe(0);
    expect(callArg.getUTCMilliseconds()).toBe(0);
    const now = new Date();
    expect(callArg.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(callArg.getUTCMonth()).toBe(now.getUTCMonth());
    expect(callArg.getUTCDate()).toBe(now.getUTCDate());
  });

  it('returns zero earned when repo returns 0', async () => {
    repo.sumPointsSince.mockResolvedValueOnce(0);
    const r = await svc.compute('student-1');
    expect(r).toEqual({ earned: 0, target: 20 });
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=daily-xp.service.spec
```

Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Create the service**

Create `src/gamification/daily-xp.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';

export const DAILY_XP_TARGET = 20;

export type DailyXp = { earned: number; target: number };

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class DailyXpService {
  constructor(private readonly results: ExerciseResultRepository) {}

  async compute(studentId: string): Promise<DailyXp> {
    const earned = await this.results.sumPointsSince(studentId, startOfUtcDay());
    return { earned, target: DAILY_XP_TARGET };
  }
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=daily-xp.service.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gamification/daily-xp.service.ts test/gamification/daily-xp.service.spec.ts
git commit -m "feat(gamification): DailyXpService with UTC-day window + 20 XP target"
```

---

### Task P5: `StreakService.incrementedToday`

**Files:**
- Modify: `src/gamification/streak.service.ts`
- Modify: `test/gamification/streak.service.spec.ts`

- [ ] **Step 1: Add a failing test case**

Open `test/gamification/streak.service.spec.ts`. Add this test inside the existing `describe('StreakService', ...)` block:

```ts
it('exposes incrementedToday: true when most recent activity is today', async () => {
  mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([today(), daysAgo(1), daysAgo(2)]);
  const r = await service.getCurrentStreak('s1');
  expect(r.incrementedToday).toBe(true);
});

it('exposes incrementedToday: false when most recent activity was yesterday', async () => {
  mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([daysAgo(1), daysAgo(2)]);
  const r = await service.getCurrentStreak('s1');
  expect(r.incrementedToday).toBe(false);
});

it('exposes incrementedToday: false on empty streak', async () => {
  mockAttempts.listSubmissionDatesByStudent.mockResolvedValueOnce([]);
  const r = await service.getCurrentStreak('s1');
  expect(r.incrementedToday).toBe(false);
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=streak.service.spec
```

Expected: FAIL — `incrementedToday` undefined.

- [ ] **Step 3: Update the service**

Edit `src/gamification/streak.service.ts`. Update the `StreakResult` type and the three return sites:

```ts
export type StreakResult = {
  current: number;
  activeToday: boolean;
  incrementedToday: boolean;  // NEW — semantically equal to activeToday today, kept distinct for future divergence
};
```

In `getCurrentStreak`, change all three `return` statements:

- The empty-dates return: `return { current: 0, activeToday: false, incrementedToday: false };`
- The else-branch (no recent activity): `return { current: 0, activeToday: false, incrementedToday: false };`
- The final return: `return { current: streak, activeToday, incrementedToday: activeToday };`

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=streak.service.spec
```

Expected: PASS, including pre-existing tests.

- [ ] **Step 5: Run the full streak-related suite**

```bash
npm test -- --testPathPattern="streak"
```

Expected: PASS (the existing `streak-review.spec.ts` still passes).

- [ ] **Step 6: Commit**

```bash
git add src/gamification/streak.service.ts test/gamification/streak.service.spec.ts
git commit -m "feat(gamification): expose incrementedToday on StreakResult"
```

---

### Task P6: `progress.service.ts` — `getRecommendation(studentId, trackId?)`

**Files:**
- Modify: `src/progress/progress.service.ts`
- Modify: `test/progress/progress.service.spec.ts` (if exists; otherwise create)

- [ ] **Step 1: Locate the existing recommendation tests**

```bash
grep -lE "getRecommendation|recommendation" test/progress/ 2>&1 | head
```

Expected: identify the file. Add the new test in that file. If none exists, create `test/progress/recommendation-track-filter.spec.ts`.

- [ ] **Step 2: Write the failing test**

Add this `describe` block to the located test file (or create a fresh file if none):

```ts
describe('getRecommendation with trackId filter', () => {
  // Reuse existing test setup that creates published Swift + Kotlin tracks
  // and a student with attempts on both.

  it('without trackId returns the existing best-match recommendation across all tracks', async () => {
    const r = await service.getRecommendation(studentId);
    expect(r.kind).not.toBe('exhausted');
  });

  it('with trackId restricts to that track only', async () => {
    const r = await service.getRecommendation(studentId, swiftTrackId);
    if (r.kind !== 'exhausted') {
      expect(r.lesson.trackId).toBe(swiftTrackId);
    }
  });

  it('returns exhausted when trackId has all lessons complete', async () => {
    // Mark every lesson in kotlinTrack as passed for studentId in test setup
    const r = await service.getRecommendation(studentId, kotlinTrackId);
    expect(r.kind).toBe('exhausted');
  });

  it('returns exhausted when trackId does not exist', async () => {
    const r = await service.getRecommendation(studentId, 'nonexistent-track-id');
    expect(r.kind).toBe('exhausted');
  });
});
```

> Note: test setup variables (`studentId`, `swiftTrackId`, `kotlinTrackId`) come from the existing recommendation test fixtures. If the file doesn't already have them, lift them from `recommendation-edge-cases.spec.ts` (commit `c9d6d8a`) which has the canonical Prisma seeding.

- [ ] **Step 3: Run the test (expect FAIL — type error or wrong filter)**

```bash
npm test -- --testPathPattern=progress
```

Expected: FAIL — `getRecommendation` signature only takes 1 arg.

- [ ] **Step 4: Update the service signature**

Edit `src/progress/progress.service.ts`. Change the method signature and add filtering:

```ts
async getRecommendation(studentId: string | null, trackId?: string): Promise<RecommendationResponse> {
  const ctx = await this.aggregateForRecommendation(studentId);
  if (!ctx.hasAnyPublishedTrack) {
    return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
  }

  let catalogOrdered = [...ctx.tracksByLessonKey.keys()].sort((a, b) => {
    const ta = ctx.tracksByLessonKey.get(a)!;
    const tb = ctx.tracksByLessonKey.get(b)!;
    if (ta.trackPublishedAt.getTime() !== tb.trackPublishedAt.getTime()) {
      return ta.trackPublishedAt.getTime() - tb.trackPublishedAt.getTime();
    }
    if (ta.trackId !== tb.trackId) return ta.trackId.localeCompare(tb.trackId);
    return ta.lessonPosition - tb.lessonPosition;
  });

  if (trackId !== undefined) {
    catalogOrdered = catalogOrdered.filter(
      (k) => ctx.tracksByLessonKey.get(k)!.trackId === trackId,
    );
    if (catalogOrdered.length === 0) {
      return { kind: 'exhausted', reason: { message: 'No lessons in the requested track.' } };
    }
  }

  // ... rest of the method unchanged (Tier 1 / Tier 2 / Tier 3 use catalogOrdered)
}
```

> Important: Tier 2's `gapConcepts` derivation also iterates over the full `ctx.conceptCounts` — wrap the gap-finding loop's `catalogOrdered.find(...)` to only match keys in the filtered `catalogOrdered`. The `find` is already restricted to that array, so no additional change is needed beyond the filter above.

- [ ] **Step 5: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=progress
```

Expected: PASS, including pre-existing recommendation tests.

- [ ] **Step 6: Commit**

```bash
git add src/progress/progress.service.ts test/progress/
git commit -m "feat(progress): getRecommendation accepts optional trackId filter"
```

---

### Task P7: `progress.controller.ts` — accept `?trackId=`

**Files:**
- Modify: `src/progress/progress.controller.ts`
- Modify or extend: `test/progress/progress.controller.spec.ts` if present, otherwise an e2e test in `test/`.

- [ ] **Step 1: Write the failing test (controller-level)**

Add to whichever spec covers `getRecommendation` at the controller layer (or create `test/progress/progress.controller.spec.ts`):

```ts
import { ProgressController } from '../../src/progress/progress.controller';

describe('ProgressController.getRecommendation', () => {
  let controller: ProgressController;
  const service = { getRecommendation: jest.fn() } as any;
  const students = { findByUserId: jest.fn().mockResolvedValue({ id: 'stu-1' }) } as any;

  beforeEach(() => {
    service.getRecommendation.mockReset();
    controller = new ProgressController(service, students);
  });

  it('passes trackId from query string to service', async () => {
    service.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: '' } });
    await controller.getRecommendation({ userId: 'u-1' }, 'track-swift');
    expect(service.getRecommendation).toHaveBeenCalledWith('stu-1', 'track-swift');
  });

  it('passes undefined when trackId is absent', async () => {
    service.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: '' } });
    await controller.getRecommendation({ userId: 'u-1' }, undefined);
    expect(service.getRecommendation).toHaveBeenCalledWith('stu-1', undefined);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=progress.controller
```

Expected: FAIL — handler doesn't take trackId.

- [ ] **Step 3: Update the controller**

Edit `src/progress/progress.controller.ts`. Update the `getRecommendation` handler:

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
// ... existing imports ...

@Get('recommendation')
@UseGuards(JwtAuthGuard)
async getRecommendation(
  @CurrentUser() user: { userId: string },
  @Query('trackId') trackId?: string,
): Promise<RecommendationResponse> {
  const student = await this.students.findByUserId(user.userId);
  const studentId = student?.id ?? null;
  return this.service.getRecommendation(studentId, trackId);
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=progress.controller
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/progress/progress.controller.ts test/progress/
git commit -m "feat(progress): GET /api/progress/recommendation accepts ?trackId="
```

---

### Task P8: `TodayPlanService`

**Files:**
- Create: `src/gamification/today-plan.service.ts`
- Test: `test/gamification/today-plan.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/gamification/today-plan.service.spec.ts`:

```ts
import { TodayPlanService } from '../../src/gamification/today-plan.service';
import { ProgressAggregatorService } from '../../src/progress/progress.service';
import { LessonRepository } from '../../src/content/repositories/lesson.repository';
import { TrackRepository } from '../../src/content/repositories/track.repository';
import { LessonInsightService } from '../../src/content/services/lesson-insight.service';

describe('TodayPlanService', () => {
  let svc: TodayPlanService;
  const progress = { getRecommendation: jest.fn() } as any;
  const lessons = { findByVersionWithBlocks: jest.fn() } as any;
  const tracks = { findLatestPublished: jest.fn() } as any;
  const insight = new LessonInsightService();

  beforeEach(() => {
    [progress, lessons, tracks].forEach((m) => Object.values(m).forEach((fn: any) => fn.mockReset?.()));
    svc = new TodayPlanService(progress, lessons, tracks, insight);
  });

  const stubLessonWithBlocks = (id: string, exerciseTypes: string[]) => ({
    id, version: 1,
    blocks: [{
      kind: 'exercises',
      exercises: exerciseTypes.map((type, i) => ({ id: `ex-${i}`, type })),
    }],
  });

  const stubTrack = (id: string, lessonIds: string[]) => ({
    id, version: 1, title: 'Swift', language: 'swift',
    lessons: lessonIds.map((lid, i) => ({ id: lid, position: i + 1, title: `L${i + 1}` })),
  });

  it('returns null when recommendation is exhausted', async () => {
    progress.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: 'done' } });
    const r = await svc.resolve('stu-1', undefined);
    expect(r).toBeNull();
  });

  it('hydrates a "continue" recommendation', async () => {
    progress.getRecommendation.mockResolvedValueOnce({
      kind: 'continue',
      lesson: { id: 'L2', version: 1, title: 'State & bindings', trackId: 'T1', trackTitle: 'Swift' },
      reason: { message: 'pick up where you left off' },
    });
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(stubLessonWithBlocks('L2', ['multiple_choice', 'code']));
    tracks.findLatestPublished.mockResolvedValueOnce(stubTrack('T1', ['L1', 'L2', 'L3']));

    const r = await svc.resolve('stu-1', undefined);
    expect(r).toEqual({
      lessonId: 'L2',
      lessonVersion: 1,
      trackId: 'T1',
      trackTitle: 'Swift',
      title: 'State & bindings',
      position: 2,
      estimatedMinutes: 5,                  // 30s + 240s = 270s = 5 min
      typeLabel: 'Concept + code',
      recommendationKind: 'continue',
      reasonMessage: 'pick up where you left off',
      conceptHint: null,
    });
  });

  it('passes trackId filter through to recommendation service', async () => {
    progress.getRecommendation.mockResolvedValueOnce({ kind: 'exhausted', reason: { message: '' } });
    await svc.resolve('stu-1', 'T-kotlin');
    expect(progress.getRecommendation).toHaveBeenCalledWith('stu-1', 'T-kotlin');
  });

  it('hydrates conceptHint on concept_gap', async () => {
    progress.getRecommendation.mockResolvedValueOnce({
      kind: 'concept_gap',
      lesson: { id: 'L1', version: 1, title: 'Optionals', trackId: 'T1', trackTitle: 'Swift' },
      reason: { message: 'practice optionals', concept: 'optionals', passed: 1, total: 4 },
    });
    lessons.findByVersionWithBlocks.mockResolvedValueOnce(stubLessonWithBlocks('L1', ['multiple_choice']));
    tracks.findLatestPublished.mockResolvedValueOnce(stubTrack('T1', ['L1']));

    const r = await svc.resolve('stu-1', 'T1');
    expect(r?.conceptHint).toBe('optionals');
    expect(r?.recommendationKind).toBe('concept_gap');
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=today-plan.service.spec
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the service**

Create `src/gamification/today-plan.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ProgressAggregatorService } from '../progress/progress.service';
import { LessonRepository } from '../content/repositories/lesson.repository';
import { TrackRepository } from '../content/repositories/track.repository';
import { LessonInsightService, ExerciseLike, TypeLabel } from '../content/services/lesson-insight.service';

export type TodayPlan = {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackTitle: string;
  title: string;
  position: number;
  estimatedMinutes: number;
  typeLabel: TypeLabel;
  recommendationKind: 'continue' | 'concept_gap' | 'first_timer';
  reasonMessage: string;
  conceptHint: string | null;
};

@Injectable()
export class TodayPlanService {
  constructor(
    private readonly progress: ProgressAggregatorService,
    private readonly lessons: LessonRepository,
    private readonly tracks: TrackRepository,
    private readonly insight: LessonInsightService,
  ) {}

  async resolve(studentId: string | null, trackId: string | undefined): Promise<TodayPlan | null> {
    const rec = await this.progress.getRecommendation(studentId, trackId);
    if (rec.kind === 'exhausted') return null;

    const [lesson, track] = await Promise.all([
      this.lessons.findByVersionWithBlocks(rec.lesson.id, rec.lesson.version),
      this.tracks.findLatestPublished(rec.lesson.trackId),
    ]);
    if (!lesson || !track) return null;

    const exercises = this.collectExercises(lesson);
    const position = this.findPosition(track, rec.lesson.id);

    return {
      lessonId: rec.lesson.id,
      lessonVersion: rec.lesson.version,
      trackId: rec.lesson.trackId,
      trackTitle: rec.lesson.trackTitle,
      title: rec.lesson.title,
      position,
      estimatedMinutes: this.insight.estimateMinutes(exercises),
      typeLabel: this.insight.deriveTypeLabel(exercises),
      recommendationKind: rec.kind,
      reasonMessage: rec.reason.message,
      conceptHint: rec.kind === 'concept_gap' ? rec.reason.concept : null,
    };
  }

  private collectExercises(lessonWithBlocks: any): ExerciseLike[] {
    const blocks = lessonWithBlocks.blocks ?? [];
    const out: ExerciseLike[] = [];
    for (const b of blocks) {
      const exs = (b as any).exercises ?? [];
      for (const e of exs) if (e?.type) out.push({ type: e.type });
    }
    return out;
  }

  private findPosition(track: any, lessonId: string): number {
    const lessons = (track as any).lessons ?? [];
    const idx = lessons.findIndex((l: any) => l.id === lessonId);
    return idx >= 0 ? idx + 1 : 0;
  }
}
```

> Note: the service uses loose `any` typing for `lesson.blocks` and `track.lessons` because the actual Prisma return shapes from `findByVersionWithBlocks` / `findLatestPublished` carry many more fields. Tests verify the behaviour on stubs.

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=today-plan.service.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gamification/today-plan.service.ts test/gamification/today-plan.service.spec.ts
git commit -m "feat(gamification): TodayPlanService composes recommendation + lesson insight"
```

---

### Task P9: Wire new services into `GamificationModule`

**Files:**
- Modify: `src/gamification/gamification.module.ts`

- [ ] **Step 1: Register new providers**

Edit `src/gamification/gamification.module.ts`. Add the three new services:

```ts
import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';
import { ProgressModule } from '../progress/progress.module';
import { BadgeRepository } from './badge.repository';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';
import { LeaderboardController } from './leaderboard.controller';
import { DashboardController } from './dashboard.controller';
import { MasteryService } from './mastery.service';
import { DailyXpService } from './daily-xp.service';
import { TodayPlanService } from './today-plan.service';

@Module({
  imports: [StateModule, ContentModule, AuthModule, ProgressModule],
  controllers: [LeaderboardController, DashboardController],
  providers: [BadgeRepository, BadgeService, StreakService, MasteryService, DailyXpService, TodayPlanService],
  exports: [BadgeService, StreakService, BadgeRepository, MasteryService, DailyXpService, TodayPlanService],
})
export class GamificationModule {}
```

> If `ProgressModule` doesn't already export `ProgressAggregatorService`, edit `src/progress/progress.module.ts` to add it to its `exports`.

- [ ] **Step 2: Verify the app boots**

```bash
npm run build
```

Expected: build succeeds, no DI cycle.

- [ ] **Step 3: Commit**

```bash
git add src/gamification/gamification.module.ts src/progress/progress.module.ts
git commit -m "chore(gamification): register MasteryService, DailyXpService, TodayPlanService"
```

---

### Task P10: Extend `DashboardController` payload

**Files:**
- Modify: `src/gamification/dashboard.controller.ts`
- Modify: `test/gamification/dashboard.controller.spec.ts`

- [ ] **Step 1: Update the failing test**

Open `test/gamification/dashboard.controller.spec.ts`. Add expectations for the new fields:

```ts
describe('GET /api/dashboard/me — extended payload', () => {
  it('returns the new fields in the empty-state response', async () => {
    // For a user with no student record
    const res = await controller.getDashboard({ userId: 'orphan-user' });
    expect(res).toMatchObject({
      streak: 0,
      streakIncrementedToday: false,
      badges: expect.any(Array),
      rank: null,
      totalPoints: 0,
      pointsEarnedToday: 0,
      dailyXp: { earned: 0, target: 20 },
      mastery: { level: 1, xpInLevel: 0, xpForNextLevel: 100 },
      todayPlan: null,
    });
  });

  it('returns hydrated todayPlan for a student with progress', async () => {
    // setup: seed a student with one in-progress attempt
    const res = await controller.getDashboard({ userId: 'active-user' });
    expect(res.todayPlan).not.toBeNull();
    expect(res.todayPlan?.recommendationKind).toBeDefined();
    expect(res.todayPlan?.estimatedMinutes).toBeGreaterThan(0);
    expect(res.dailyXp.target).toBe(20);
    expect(typeof res.streakIncrementedToday).toBe('boolean');
    expect(res.mastery.level).toBeGreaterThanOrEqual(1);
  });

  it('honours ?trackId= query param by passing it to TodayPlanService', async () => {
    const res = await controller.getDashboard({ userId: 'active-user' }, 'track-swift-id');
    if (res.todayPlan) expect(res.todayPlan.trackId).toBe('track-swift-id');
  });
});
```

> Reuse the existing test setup that seeds an "orphan" and an "active" user in `beforeEach`.

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- --testPathPattern=dashboard.controller.spec
```

Expected: FAIL — new fields not present.

- [ ] **Step 3: Update the controller**

Edit `src/gamification/dashboard.controller.ts`. Replace the file:

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { BadgeRepository } from './badge.repository';
import { StreakService } from './streak.service';
import { BADGES, BadgeDefinition } from './badge.definitions';
import { StudentBadge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService, MasteryProgress } from './mastery.service';
import { DailyXpService, DailyXp, DAILY_XP_TARGET } from './daily-xp.service';
import { TodayPlanService, TodayPlan } from './today-plan.service';

export type BadgeStatus = BadgeDefinition & { earned: boolean; earnedAt?: Date };

export type DashboardResponse = {
  streak: number;
  streakIncrementedToday: boolean;
  badges: BadgeStatus[];
  rank: number | null;
  totalPoints: number;
  pointsEarnedToday: number;
  dailyXp: DailyXp;
  mastery: MasteryProgress;
  todayPlan: TodayPlan | null;
};

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly students: StudentRepository,
    private readonly results: ExerciseResultRepository,
    private readonly badgeRepo: BadgeRepository,
    private readonly streak: StreakService,
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly dailyXp: DailyXpService,
    private readonly todayPlan: TodayPlanService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getDashboard(
    @CurrentUser() user: { userId: string },
    @Query('trackId') trackId?: string,
  ): Promise<DashboardResponse> {
    const student = await this.students.findByUserId(user.userId);

    if (!student) {
      return {
        streak: 0,
        streakIncrementedToday: false,
        badges: BADGES.map((b) => ({ ...b, earned: false })),
        rank: null,
        totalPoints: 0,
        pointsEarnedToday: 0,
        dailyXp: { earned: 0, target: DAILY_XP_TARGET },
        mastery: this.mastery.compute(0),
        todayPlan: null,
      };
    }

    const studentId = student.id;

    const pointsAgg = await this.prisma.exerciseResult.aggregate({
      where: { studentId },
      _sum: { pointsEarned: true },
    });
    const totalPoints = pointsAgg._sum.pointsEarned ?? 0;

    const streakResult = await this.streak.getCurrentStreak(studentId);

    const earnedBadges = await this.badgeRepo.findByStudent(studentId);
    const earnedMap = new Map<string, StudentBadge>(
      earnedBadges.map((b) => [b.badgeId, b]),
    );
    const badges: BadgeStatus[] = BADGES.map((b) => {
      const earned = earnedMap.get(b.id);
      return { ...b, earned: !!earned, earnedAt: earned?.earnedAt };
    });

    const allStudents = await this.students.findAll();
    const allStudentIds = allStudents.map((s) => s.id);
    const allTotals = await this.prisma.exerciseResult.groupBy({
      by: ['studentId'],
      where: { studentId: { in: allStudentIds } },
      _sum: { pointsEarned: true },
    });
    const allPointsMap = new Map(
      allTotals.map((t) => [t.studentId, t._sum.pointsEarned ?? 0]),
    );
    const pointsByStudent = allStudents.map((s) => ({
      id: s.id,
      pts: allPointsMap.get(s.id) ?? 0,
    }));
    pointsByStudent.sort((a, b) => b.pts - a.pts);
    const rankIdx = pointsByStudent.findIndex((s) => s.id === studentId);
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;

    const [dailyXp, todayPlan] = await Promise.all([
      this.dailyXp.compute(studentId),
      this.todayPlan.resolve(studentId, trackId),
    ]);
    const mastery = this.mastery.compute(totalPoints);

    return {
      streak: streakResult.current,
      streakIncrementedToday: streakResult.incrementedToday,
      badges,
      rank,
      totalPoints,
      pointsEarnedToday: dailyXp.earned,
      dailyXp,
      mastery,
      todayPlan,
    };
  }
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- --testPathPattern=dashboard.controller.spec
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gamification/dashboard.controller.ts test/gamification/dashboard.controller.spec.ts
git commit -m "feat(dashboard): extend payload with todayPlan, dailyXp, mastery, streakIncrementedToday"
```

---

### Task P11: Phase 1 verification + PR + merge

**Files:** none — verification only.

- [ ] **Step 1: Full test suite green**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 2: Build green**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Start the local stack and curl the new endpoint:

```bash
# In platform/ root
docker compose up -d postgres
npm run start:dev &
sleep 10
# Create a JWT for a known user via the auth flow, then:
curl -H "Cookie: jwt=$JWT" http://localhost:3000/api/dashboard/me | jq
```

Expected: response contains `todayPlan`, `dailyXp`, `mastery`, `streakIncrementedToday`, `pointsEarnedToday`.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/dashboard-payload
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "feat(dashboard): extended payload for new dashboard UI" --body "$(cat <<'EOF'
## Summary
- Adds `todayPlan`, `dailyXp`, `mastery`, `streakIncrementedToday`, `pointsEarnedToday` to `GET /api/dashboard/me`
- `GET /api/dashboard/me` and `GET /api/progress/recommendation` accept `?trackId=` for track-aware recommendations
- New services: `MasteryService`, `DailyXpService`, `TodayPlanService`, `LessonInsightService`
- StreakResult exposes `incrementedToday` for "+1 today" UI delta
- ExerciseResultRepository.sumPointsSince powers daily-XP queries

## Test plan
- [ ] All Jest suites green
- [ ] `npm run build` clean
- [ ] Manual `curl /api/dashboard/me` returns new shape

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: After review, merge with --no-ff**

```bash
git checkout master
git pull
git merge --no-ff feat/dashboard-payload -m "merge: dashboard payload extension"
git push origin master
```

- [ ] **Step 7: Stop here until platform PR is deployed**

Web Phase 2 has been running in parallel against the fixture; once platform `master` is deployed, point web's runtime at the live endpoint and complete Phase 2.

---

## Phase 2 — `web/` (`feat/dashboard` worktree)

All Phase 2 tasks run in `c:/tmp/bootcamp-web-dashboard`.

### Task W0: Add the dashboard fixture

**Files:**
- Create: `lib/__fixtures__/dashboard.fixture.ts`

- [ ] **Step 1: Create the fixture**

Create `lib/__fixtures__/dashboard.fixture.ts`:

```ts
import type { DashboardData } from '@/lib/gamification';

export const dashboardContinueFixture: DashboardData = {
  streak: 12,
  streakIncrementedToday: true,
  badges: [
    { id: 'first-lesson', name: 'First lesson', description: 'Complete your first lesson', icon: '🎯', earned: true, earnedAt: '2026-04-15T10:00:00Z' },
    { id: 'week-streak', name: '7-day streak', description: 'Practice 7 days in a row', icon: '🔥', earned: true },
    { id: 'concept-master', name: 'Concept master', description: 'Pass every exercise in a concept', icon: '🧠', earned: false },
  ],
  rank: 7,
  totalPoints: 1240,
  pointsEarnedToday: 18,
  dailyXp: { earned: 18, target: 20 },
  mastery: { level: 4, xpInLevel: 640, xpForNextLevel: 360 },
  todayPlan: {
    lessonId: 'lesson-state-bindings',
    lessonVersion: 1,
    trackId: 'track-swift',
    trackTitle: 'iOS Development with SwiftUI',
    title: 'State, Bindings, and the @State property wrapper',
    position: 8,
    estimatedMinutes: 6,
    typeLabel: 'Concept + quiz',
    recommendationKind: 'continue',
    reasonMessage: 'pick up where you left off',
    conceptHint: null,
  },
};

export const dashboardExhaustedFixture: DashboardData = {
  ...dashboardContinueFixture,
  streakIncrementedToday: false,
  todayPlan: null,
};

export const dashboardConceptGapFixture: DashboardData = {
  ...dashboardContinueFixture,
  todayPlan: {
    ...dashboardContinueFixture.todayPlan!,
    title: 'Optionals revisited',
    recommendationKind: 'concept_gap',
    reasonMessage: 'Practice optionals — you\'ve passed 2/5 so far.',
    conceptHint: 'optionals',
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/__fixtures__/dashboard.fixture.ts
git commit -m "test(dashboard): fixture for new payload shape"
```

---

### Task W1: CSS port

**Files:**
- Modify: `styles/app.css`

- [ ] **Step 1: Replace `styles/app.css` with the ported slice**

Open `c:/tmp/design-bootcamp/bootcamp/project/app.css` for reference and write `styles/app.css`:

```css
/* app.css — page-level layout consumed by AppShell + page bodies. */

/* ===== App shell (Sub-project B back-fill) ===== */

.app {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.side {
  border-right: 1px solid var(--line-1);
  padding: 22px 16px;
  position: sticky; top: 0;
  height: 100vh;
  display: flex; flex-direction: column;
  gap: 6px;
  background: rgba(7,9,13,0.6);
  backdrop-filter: blur(10px);
  z-index: 5;
}
:root[data-theme="light"] .side { background: rgba(255,255,255,0.7); }

.side-section { font-size: var(--t-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); padding: 18px 10px 6px; }
.side-link {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: var(--r-sm);
  font-size: var(--t-sm); color: var(--text-2);
  cursor: pointer;
  transition: background var(--d-fast), color var(--d-fast);
}
.side-link:hover { background: var(--bg-2); color: var(--text-1); }
.side-link.active { background: var(--brand-bg); color: var(--peacock-100); }
.side-link.active .side-icon { color: var(--peacock-300); }
.side-icon { width: 18px; height: 18px; color: var(--text-3); flex: none; }
.side-link .badge { margin-left: auto; }

.topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 16px 32px;
  border-bottom: 1px solid var(--line-1);
  background: rgba(7,9,13,0.5);
  backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 4;
}
:root[data-theme="light"] .topbar { background: rgba(255,255,255,0.7); }
.topbar .search { flex: 1; max-width: 480px; }

.main { padding: 32px 32px 80px; max-width: 1280px; margin: 0 auto; width: 100%; }
.main-narrow { max-width: 980px; }

.page-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.page-head .h-display { font-size: var(--t-4xl); }

.seg {
  display: inline-flex;
  padding: 4px;
  border-radius: var(--r-md);
  background: var(--bg-2);
  border: 1px solid var(--line-1);
}
.seg-btn {
  padding: 8px 14px;
  font-size: var(--t-sm); font-weight: 600;
  color: var(--text-3); border-radius: var(--r-sm);
  display: inline-flex; align-items: center; gap: 8px;
  transition: all var(--d-fast);
}
.seg-btn:hover { color: var(--text-1); }
.seg-btn.active { background: var(--bg-3); color: var(--text-1); box-shadow: var(--sh-1); }
.seg-btn.active.swift { color: var(--iris-300); }
.seg-btn.active.kotlin { color: var(--amber-300); }

/* ===== Dashboard (Sub-project C) ===== */

.daily {
  border-radius: var(--r-xl);
  padding: 28px;
  background:
    linear-gradient(135deg, rgba(10,166,196,0.18), rgba(74,100,238,0.10) 50%, rgba(214,56,143,0.16)),
    var(--bg-2);
  border: 1px solid var(--line-2);
  position: relative;
  overflow: hidden;
}
.daily::after {
  content: ""; position: absolute;
  right: -120px; top: -120px; width: 360px; height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(214,56,143,0.30), transparent 60%);
  filter: blur(20px);
}
.daily-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 28px; align-items: center; position: relative; z-index: 1; }

.lesson-row {
  display: grid;
  grid-template-columns: 56px 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--line-1);
  background: var(--bg-1);
  transition: all var(--d-fast);
  cursor: pointer;
}
.lesson-row:hover { border-color: var(--line-3); background: var(--bg-2); transform: translateY(-1px); }
.lesson-icon {
  width: 44px; height: 44px;
  border-radius: var(--r-md);
  background: var(--bg-3);
  display: grid; place-items: center;
  color: var(--text-2);
  border: 1px solid var(--line-2);
  flex: none;
}
.lesson-row.completed .lesson-icon { background: color-mix(in oklch, var(--success-400) 18%, var(--bg-2)); color: var(--success-400); border-color: color-mix(in oklch, var(--success-400) 40%, transparent); }

.lb-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid transparent;
}
.lb-row.you {
  background: var(--brand-bg);
  border-color: color-mix(in oklch, var(--peacock-400) 40%, transparent);
}
.lb-rank {
  font-family: var(--font-mono); font-weight: 700;
  color: var(--text-3); text-align: center;
}
.lb-rank.top { color: var(--amber-400); }

.stack { display: flex; flex-direction: column; gap: 16px; }
.stack-tight { gap: 8px; }
.stack-loose { gap: 24px; }
```

- [ ] **Step 2: Manually sweep all 8 authed routes for layout regressions**

Start dev server:

```bash
npm run dev
```

Open each route, confirm no broken layouts:

```
http://localhost:3001/dashboard
http://localhost:3001/tracks
http://localhost:3001/tracks/[any-id]
http://localhost:3001/lesson/[any-id]
http://localhost:3001/badges
http://localhost:3001/review
http://localhost:3001/instructor          (instructor account)
http://localhost:3001/instructor/review/[any-id]
```

Expected: chrome paints with sticky sidebar, blurred topbar; page bodies still readable. Capture any regressions in follow-up commits within Task W1 before moving on.

- [ ] **Step 3: Run lint + tests**

```bash
npm run lint && npm test
```

Expected: no failures.

- [ ] **Step 4: Commit**

```bash
git add styles/app.css
git commit -m "feat(styles): port app shell + dashboard CSS from design bundle"
```

---

### Task W2: `TrackContext` provider + hook

**Files:**
- Create: `lib/track-context.tsx`
- Test: `tests/lib/track-context.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/track-context.test.tsx`:

```tsx
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { TrackProvider, useActiveTrack } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';

vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));

const TRACKS = [
  { id: 'swift', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Kotlin', language: 'kotlin', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
];

function Probe() {
  const { trackId, setTrackId, tracks, loading } = useActiveTrack();
  return (
    <>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="trackId">{trackId ?? 'null'}</span>
      <span data-testid="tracks">{tracks.map((t) => t.id).join(',')}</span>
      <button onClick={() => setTrackId('kotlin')}>switch</button>
    </>
  );
}

describe('TrackProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
  });

  it('renders with trackId=null while loading', async () => {
    let resolveTracks: (v: typeof TRACKS) => void;
    vi.mocked(tracksLib.fetchTracks).mockReturnValue(new Promise((r) => { resolveTracks = r; }));
    render(<TrackProvider><Probe /></TrackProvider>);
    expect(screen.getByTestId('trackId').textContent).toBe('null');
    expect(screen.getByTestId('loading').textContent).toBe('true');
    act(() => resolveTracks(TRACKS));
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  });

  it('defaults to first track when localStorage is empty', async () => {
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
    expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('swift');
  });

  it('hydrates from localStorage when present and valid', async () => {
    localStorage.setItem('bootcamp.activeTrackId', 'kotlin');
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('kotlin'));
  });

  it('falls back to first track when stored value is stale', async () => {
    localStorage.setItem('bootcamp.activeTrackId', 'rust');
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
  });

  it('persists setTrackId changes', async () => {
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
    await userEvent.click(screen.getByText('switch'));
    expect(screen.getByTestId('trackId').textContent).toBe('kotlin');
    expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('kotlin');
  });

  it('handles empty tracks array', async () => {
    vi.mocked(tracksLib.fetchTracks).mockResolvedValueOnce([]);
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('trackId').textContent).toBe('null');
  });

  it('throws when useActiveTrack is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <TrackProvider>/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- track-context
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the provider**

Create `lib/track-context.tsx`:

```tsx
'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchTracks, type TrackSummary } from '@/lib/tracks';

const STORAGE_KEY = 'bootcamp.activeTrackId';

type TrackContextValue = {
  trackId: string | null;
  setTrackId: (id: string) => void;
  tracks: TrackSummary[];
  loading: boolean;
};

const TrackContext = createContext<TrackContextValue | null>(null);

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStorage(id: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function TrackProvider({ children }: { children: ReactNode }) {
  const [trackId, _setTrackId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchTracks()
      .then((ts) => {
        if (!alive) return;
        setTracks(ts);
        const stored = readStorage();
        if (stored && ts.some((t) => t.id === stored)) _setTrackId(stored);
        else if (ts.length > 0) {
          _setTrackId(ts[0].id);
          writeStorage(ts[0].id);
        }
      })
      .catch(() => { /* leave trackId null, tracks empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const setTrackId = (id: string) => {
    _setTrackId(id);
    writeStorage(id);
  };

  return (
    <TrackContext.Provider value={{ trackId, setTrackId, tracks, loading }}>
      {children}
    </TrackContext.Provider>
  );
}

export function useActiveTrack(): TrackContextValue {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error('useActiveTrack must be used inside <TrackProvider>');
  return ctx;
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- track-context
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/track-context.tsx tests/lib/track-context.test.tsx
git commit -m "feat(lib): TrackProvider + useActiveTrack with localStorage persistence"
```

---

### Task W3: Mount `TrackProvider` and wire chrome consumers

**Files:**
- Modify: `app/(authed)/layout.tsx`
- Modify: `components/shell/Topbar.tsx`
- Modify: `components/shell/ActiveTrackPill.tsx`
- Modify: `tests/shell/Topbar.test.tsx`
- Modify: `tests/shell/ActiveTrackPill.test.tsx`

- [ ] **Step 1: Update `(authed)/layout.tsx`**

Edit `app/(authed)/layout.tsx`:

```tsx
'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
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

  return (
    <TrackProvider>
      <div className="app">
        <Sidebar />
        <div>
          <Topbar />
          <main className="main">{children}</main>
        </div>
      </div>
    </TrackProvider>
  );
}
```

- [ ] **Step 2: Update Topbar test (extend existing)**

Open `tests/shell/Topbar.test.tsx`. Add a wrapping `<TrackProvider>` and these assertions:

```tsx
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';

vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));

const TRACKS = [
  { id: 'swift', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Kotlin', language: 'kotlin', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
];

beforeEach(() => {
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
});

it('SegmentedControl options reflect tracks from TrackProvider', async () => {
  render(<TrackProvider><AuthMock><Topbar /></AuthMock></TrackProvider>);
  await screen.findByText('Swift');
  expect(screen.getByText('Kotlin')).toBeInTheDocument();
});

it('clicking a segment calls setTrackId via the context', async () => {
  render(<TrackProvider><AuthMock><Topbar /></AuthMock></TrackProvider>);
  await userEvent.click(await screen.findByText('Kotlin'));
  expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('kotlin');
});
```

> `AuthMock` is the test helper that already wraps Topbar test renders with a mock `<AuthProvider>`. If absent, inline a `value={{ user: { id, name }, streak: 5, totalPoints: 100 }}` provider stub.

- [ ] **Step 3: Run the test (expect FAIL)**

```bash
npm test -- shell/Topbar
```

Expected: FAIL — Topbar's SegmentedControl is hardcoded.

- [ ] **Step 4: Update `Topbar.tsx`**

Replace `components/shell/Topbar.tsx`:

```tsx
'use client';
import { Icon } from '@/components/ui/Icon';
import { Row } from '@/components/ui/Row';
import { SearchInput } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';

export function Topbar() {
  const { streak, totalPoints } = useAuth();
  const { trackId, setTrackId, tracks, loading } = useActiveTrack();
  const swiftKotlin = tracks.filter((t) => t.language === 'swift' || t.language === 'kotlin');
  const value = trackId ?? swiftKotlin[0]?.id ?? '';
  return (
    <div className="topbar">
      <SearchInput
        placeholder="Search lessons coming soon"
        disabled
        wrapperClassName="search"
        style={{ flex: 1, maxWidth: 480 }}
      />
      {swiftKotlin.length > 0 && (
        <SegmentedControl
          value={value}
          onChange={setTrackId}
          options={swiftKotlin.map((t) => ({
            value: t.id,
            label: t.language === 'swift' ? 'Swift' : 'Kotlin',
            activeClassName: t.language,
          }))}
          aria-disabled={loading}
        />
      )}
      <Row style={{ gap: 14, marginLeft: 'auto' }}>
        <Row style={{ gap: 6 }}>
          <Icon name="flame" size={16} style={{ color: 'var(--amber-400)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{streak}</span>
        </Row>
        <Row style={{ gap: 6 }}>
          <Icon name="bolt" size={16} style={{ color: 'var(--peacock-300)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{totalPoints.toLocaleString()}</span>
        </Row>
      </Row>
    </div>
  );
}
```

- [ ] **Step 5: Update `ActiveTrackPill.tsx`**

Replace `components/shell/ActiveTrackPill.tsx`:

```tsx
'use client';
import { Badge } from '@/components/ui/Badge';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';

export function ActiveTrackPill() {
  const { totalPoints } = useAuth();
  const { trackId, tracks } = useActiveTrack();
  const active = tracks.find((t) => t.id === trackId);
  const tone = active?.language === 'kotlin' ? 'amber' : 'iris';
  const label = active?.language === 'kotlin' ? 'Kotlin' : 'Swift';
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)',
        marginBottom: 8,
        background: 'var(--bg-1)',
      }}
    >
      <Eyebrow style={{ marginBottom: 8 }}>Active track</Eyebrow>
      <Row style={{ gap: 10 }}>
        <Badge tone={tone} dot>{label}</Badge>
        <span className="muted mono" style={{ fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
          {totalPoints.toLocaleString()} XP
        </span>
      </Row>
    </div>
  );
}
```

- [ ] **Step 6: Update ActiveTrackPill test**

Edit `tests/shell/ActiveTrackPill.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { ActiveTrackPill } from '@/components/shell/ActiveTrackPill';
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';
// ... import AuthMock helper or stub provider

vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));

const TRACKS = [
  { id: 'swift', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Kotlin', language: 'kotlin', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
});

it('shows Swift badge when active track is swift (default)', async () => {
  render(<TrackProvider><AuthMock><ActiveTrackPill /></AuthMock></TrackProvider>);
  await waitFor(() => expect(screen.getByText('Swift')).toBeInTheDocument());
});

it('shows Kotlin badge when active track is kotlin', async () => {
  localStorage.setItem('bootcamp.activeTrackId', 'kotlin');
  render(<TrackProvider><AuthMock><ActiveTrackPill /></AuthMock></TrackProvider>);
  await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument());
});
```

- [ ] **Step 7: Run all shell tests**

```bash
npm test -- shell
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add app/\(authed\)/layout.tsx components/shell/Topbar.tsx components/shell/ActiveTrackPill.tsx tests/shell/Topbar.test.tsx tests/shell/ActiveTrackPill.test.tsx
git commit -m "feat(shell): wire Topbar + ActiveTrackPill to TrackContext"
```

---

### Task W4: Widen `lib/gamification.ts` types and signature

**Files:**
- Modify: `lib/gamification.ts`

- [ ] **Step 1: Replace the type + signature**

Edit `lib/gamification.ts`:

```ts
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export type BadgeStatus = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
};

export type DailyXp = { earned: number; target: number };
export type MasteryProgress = { level: number; xpInLevel: number; xpForNextLevel: number };
export type TodayPlan = {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackTitle: string;
  title: string;
  position: number;
  estimatedMinutes: number;
  typeLabel: 'Concept + quiz' | 'Code + tests' | 'Concept + code' | 'Capstone';
  recommendationKind: 'continue' | 'concept_gap' | 'first_timer';
  reasonMessage: string;
  conceptHint: string | null;
};

export type DashboardData = {
  streak: number;
  streakIncrementedToday: boolean;
  badges: BadgeStatus[];
  rank: number | null;
  totalPoints: number;
  pointsEarnedToday: number;
  dailyXp: DailyXp;
  mastery: MasteryProgress;
  todayPlan: TodayPlan | null;
};

export type LeaderboardEntry = { rank: number; studentId: string; name: string; totalPoints: number; streak: number };
export type LeaderboardData = { entries: LeaderboardEntry[]; myRank: number | null };

export async function fetchDashboard(trackId?: string): Promise<DashboardData> {
  const url = trackId ? `${BASE}/api/dashboard/me?trackId=${encodeURIComponent(trackId)}` : `${BASE}/api/dashboard/me`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

export async function fetchLeaderboard(cohortId?: string): Promise<LeaderboardData> {
  const url = cohortId ? `${BASE}/api/leaderboard?cohortId=${cohortId}` : `${BASE}/api/leaderboard`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build green (the fixture from W0 should typecheck against the new shape).

- [ ] **Step 3: Commit**

```bash
git add lib/gamification.ts
git commit -m "feat(lib): widen DashboardData with todayPlan, dailyXp, mastery; fetchDashboard(trackId?)"
```

---

### Task W5: `LessonRow` shared primitive

**Files:**
- Create: `components/dashboard/LessonRow.tsx`
- Test: `tests/dashboard/LessonRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/LessonRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LessonRow } from '@/components/dashboard/LessonRow';

describe('LessonRow', () => {
  it('renders title, meta, and links to href', () => {
    render(<LessonRow icon="play" title="State & bindings" meta="Concept · 6 min" state="next" href="/lesson/L8" />);
    const link = screen.getByRole('link', { name: /State & bindings/ });
    expect(link).toHaveAttribute('href', '/lesson/L8');
    expect(screen.getByText('Concept · 6 min')).toBeInTheDocument();
  });

  it('emits .lesson-row class for queued state', () => {
    const { container } = render(<LessonRow icon="book" title="x" meta="y" state="queued" href="/x" />);
    expect(container.querySelector('a.lesson-row')).toBeInTheDocument();
    expect(container.querySelector('a.lesson-row.completed')).toBeNull();
  });

  it('emits .lesson-row.completed for completed state', () => {
    const { container } = render(<LessonRow icon="check" title="x" meta="y" state="completed" href="/x" />);
    expect(container.querySelector('a.lesson-row.completed')).toBeInTheDocument();
  });

  it('applies accentColor inline style on .lesson-icon when state="next"', () => {
    const { container } = render(<LessonRow icon="play" title="x" meta="y" state="next" href="/x" accentColor="rgb(255, 0, 0)" />);
    const icon = container.querySelector('.lesson-icon') as HTMLElement;
    expect(icon.style.background).toBe('rgb(255, 0, 0)');
    expect(icon.style.borderColor).toBe('rgb(255, 0, 0)');
  });

  it('does NOT apply accentColor when state is not "next"', () => {
    const { container } = render(<LessonRow icon="check" title="x" meta="y" state="completed" href="/x" accentColor="red" />);
    const icon = container.querySelector('.lesson-icon') as HTMLElement;
    expect(icon.style.background).toBe('');
  });

  it('renders the badge slot when provided', () => {
    render(<LessonRow icon="play" title="x" meta="y" state="next" href="/x" badge={<span data-testid="b">Next</span>} />);
    expect(screen.getByTestId('b')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- LessonRow
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/dashboard/LessonRow.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/components/ui/cn';

export type LessonRowProps = {
  icon: IconName;
  title: string;
  meta: string;
  state: 'next' | 'queued' | 'completed';
  href: string;
  badge?: ReactNode;
  accentColor?: string;
};

export function LessonRow({ icon, title, meta, state, href, badge, accentColor }: LessonRowProps) {
  const className = cn('lesson-row', state === 'completed' && 'completed');
  const iconStyle =
    state === 'next' && accentColor
      ? { background: accentColor, color: '#0a0a0a', borderColor: accentColor }
      : undefined;
  return (
    <Link href={href} className={className}>
      <div className="lesson-icon" style={iconStyle}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div className="muted mono" style={{ fontSize: 'var(--t-xs)' }}>{meta}</div>
      </div>
      {badge ?? <span />}
      <Icon name="chevR" size={16} style={{ color: 'var(--text-3)' }} />
    </Link>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
npm test -- LessonRow
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/LessonRow.tsx tests/dashboard/LessonRow.test.tsx
git commit -m "feat(dashboard): LessonRow shared primitive"
```

---

### Task W6: `DailyStrip`

**Files:**
- Create: `components/dashboard/DailyStrip.tsx`
- Test: `tests/dashboard/DailyStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/DailyStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DailyStrip } from '@/components/dashboard/DailyStrip';
import { dashboardContinueFixture, dashboardExhaustedFixture } from '@/lib/__fixtures__/dashboard.fixture';

describe('DailyStrip', () => {
  it('renders todayPlan title, badges, and KPIs', () => {
    render(<DailyStrip dash={dashboardContinueFixture} />);
    expect(screen.getByText('State, Bindings, and the @State property wrapper')).toBeInTheDocument();
    expect(screen.getByText('L8')).toBeInTheDocument();
    expect(screen.getByText('Concept + quiz')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();             // streak
    expect(screen.getByText('18 / 20')).toBeInTheDocument();         // daily xp
    expect(screen.getByText('L4')).toBeInTheDocument();              // mastery level
    expect(screen.getByText('360 XP to L5')).toBeInTheDocument();
  });

  it('shows "+1 today" delta when streakIncrementedToday is true', () => {
    render(<DailyStrip dash={dashboardContinueFixture} />);
    expect(screen.getByText('+1 today')).toBeInTheDocument();
  });

  it('shows "Keep going" delta when streakIncrementedToday is false', () => {
    const dash = { ...dashboardContinueFixture, streakIncrementedToday: false };
    render(<DailyStrip dash={dash} />);
    expect(screen.queryByText('+1 today')).not.toBeInTheDocument();
    expect(screen.getByText('Keep going')).toBeInTheDocument();
  });

  it('renders empty-state copy when todayPlan is null', () => {
    render(<DailyStrip dash={dashboardExhaustedFixture} />);
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review/i })).toHaveAttribute('href', '/review');
    expect(screen.getByText('12')).toBeInTheDocument();              // KPIs still render
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
npm test -- DailyStrip
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/dashboard/DailyStrip.tsx`:

```tsx
import Link from 'next/link';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { Row } from '@/components/ui/Row';
import { KPI } from '@/components/ui/KPI';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import type { DashboardData } from '@/lib/gamification';

type Props = { dash: DashboardData };

export function DailyStrip({ dash }: Props) {
  return (
    <div className="daily">
      <div className="daily-grid">
        {dash.todayPlan ? <PlanHero dash={dash} /> : <ExhaustedHero />}
        <KPI label="Streak" value={(
          <span className="kpi-value mono">
            <Icon name="flame" size={24} style={{ color: 'var(--amber-400)', marginRight: 8 }} />{dash.streak}
          </span>
        )} delta={dash.streakIncrementedToday ? '+1 today' : 'Keep going'} />
        <KPI label="Daily XP" value={(
          <span className="kpi-value mono peacock-text">{dash.dailyXp.earned} / {dash.dailyXp.target}</span>
        )} delta={(
          <ProgressBar value={Math.min(100, (dash.dailyXp.earned / dash.dailyXp.target) * 100)} thin />
        )} />
        <KPI label="Mastery" value={(
          <span className="kpi-value mono">L{dash.mastery.level}</span>
        )} delta={(
          <span className="muted">{dash.mastery.xpForNextLevel} XP to L{dash.mastery.level + 1}</span>
        )} />
      </div>
    </div>
  );
}

function PlanHero({ dash }: Props) {
  const plan = dash.todayPlan!;
  return (
    <div>
      <Eyebrow style={{ marginBottom: 10, color: 'var(--peacock-200)' }}>
        Today's plan · {plan.estimatedMinutes} min
      </Eyebrow>
      <Heading level="2" style={{ marginBottom: 10 }}>{plan.title}</Heading>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Badge mono>L{plan.position}</Badge>
        <Badge>{plan.typeLabel}</Badge>
        <Badge dot>{plan.estimatedMinutes} min</Badge>
      </Row>
    </div>
  );
}

function ExhaustedHero() {
  return (
    <div>
      <Eyebrow style={{ marginBottom: 10, color: 'var(--peacock-200)' }}>Today</Eyebrow>
      <Heading level="2" style={{ marginBottom: 10 }}>All caught up</Heading>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/review" className="btn btn-ghost btn-sm">Review queue</Link>
      </Row>
    </div>
  );
}
```

> If the `KPI` primitive's prop API differs (e.g. expects `value` as a string only, not ReactNode), inline the `.kpi-value`/`.kpi-label`/`.kpi-delta` markup directly using `Stack` + class names from `components.css`. Verify by reading `components/ui/KPI.tsx` first.

- [ ] **Step 4: Verify KPI primitive supports ReactNode value, or inline**

```bash
grep -nE "value:" components/ui/KPI.tsx | head
```

If it expects `string`, replace the `<KPI ...>` blocks with inline markup matching the `.kpi`, `.kpi-label`, `.kpi-value`, `.kpi-delta` class structure from `components.css`.

- [ ] **Step 5: Run the test (expect PASS)**

```bash
npm test -- DailyStrip
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/DailyStrip.tsx tests/dashboard/DailyStrip.test.tsx
git commit -m "feat(dashboard): DailyStrip with hero + 3 KPIs"
```

---

### Task W7: `UpNextList`

**Files:**
- Create: `components/dashboard/UpNextList.tsx`
- Test: `tests/dashboard/UpNextList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/UpNextList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpNextList } from '@/components/dashboard/UpNextList';

const TRACK = {
  id: 't1', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '',
  lessonCount: 6, starterRepoUrl: null,
  lessons: [
    { id: 'L1', version: 1, title: 'Optionals',   level: 'foundation', summary: '', position: 1 },
    { id: 'L2', version: 1, title: 'Closures',    level: 'foundation', summary: '', position: 2 },
    { id: 'L3', version: 1, title: 'State',       level: 'foundation', summary: '', position: 3 },
    { id: 'L4', version: 1, title: 'Bindings',    level: 'foundation', summary: '', position: 4 },
    { id: 'L5', version: 1, title: 'Navigation',  level: 'foundation', summary: '', position: 5 },
    { id: 'L6', version: 1, title: 'Animations',  level: 'intermediate', summary: '', position: 6 },
  ],
};

const PROGRESS = {
  trackId: 't1',
  lessons: [
    { lessonId: 'L1', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-04-30T12:00:00Z' },
    { lessonId: 'L2', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-05-01T12:00:00Z' },
    { lessonId: 'L3', lessonVersion: 1, totalExercises: 4, passedExercises: 2, attemptedExercises: 3, state: 'in_progress' as const, lastAttemptAt: '2026-05-02T08:00:00Z' },
  ],
};

const TODAY_PLAN = {
  lessonId: 'L3', lessonVersion: 1, trackId: 't1', trackTitle: 'Swift', title: 'State', position: 3,
  estimatedMinutes: 6, typeLabel: 'Concept + quiz' as const,
  recommendationKind: 'continue' as const, reasonMessage: '', conceptHint: null,
};

describe('UpNextList', () => {
  it('renders L3..L6 as the next four (skipping completed L1, L2)', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={TODAY_PLAN} accentColor="red" />);
    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByText('Bindings')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Animations')).toBeInTheDocument();
    expect(screen.queryByText('Optionals')).not.toBeInTheDocument();
  });

  it('first row gets the "Next" badge', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={TODAY_PLAN} accentColor="red" />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('falls back to first-not-complete when todayPlan is null', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={null} accentColor="red" />);
    expect(screen.getByText('State')).toBeInTheDocument();         // L3 first not-complete
    expect(screen.queryByText('Optionals')).not.toBeInTheDocument();
  });

  it('renders empty-state copy when no candidates', () => {
    const allComplete = {
      trackId: 't1',
      lessons: TRACK.lessons.map((l) => ({
        lessonId: l.id, lessonVersion: 1, totalExercises: 4, passedExercises: 4,
        attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-05-01T00:00:00Z',
      })),
    };
    render(<UpNextList track={TRACK} progress={allComplete} todayPlan={null} accentColor="red" />);
    expect(screen.getByText(/No upcoming lessons/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- UpNextList
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/dashboard/UpNextList.tsx`:

```tsx
import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import type { TodayPlan } from '@/lib/gamification';
import { Heading } from '@/components/ui/Heading';
import { Row } from '@/components/ui/Row';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { LessonRow } from './LessonRow';

type Props = {
  track: TrackDetail;
  progress: TrackProgress | undefined;
  todayPlan: TodayPlan | null;
  accentColor: string;
};

export function UpNextList({ track, progress, todayPlan, accentColor }: Props) {
  const completedIds = new Set(
    (progress?.lessons ?? []).filter((l) => l.state === 'complete').map((l) => l.lessonId),
  );
  const startIdx = todayPlan
    ? Math.max(0, track.lessons.findIndex((l) => l.id === todayPlan.lessonId))
    : 0;
  const candidates = track.lessons.slice(startIdx).filter((l) => !completedIds.has(l.id)).slice(0, 4);

  return (
    <div className="stack">
      <Row style={{ justifyContent: 'space-between' }}>
        <Heading level="3">Up next</Heading>
        <Button variant="ghost" size="sm" href="/tracks">View skill tree<Icon name="chevR" size={14} /></Button>
      </Row>
      {candidates.length === 0 ? (
        <p className="muted">No upcoming lessons in this track.</p>
      ) : (
        <div className="stack stack-tight">
          {candidates.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              icon={i === 0 ? 'play' : 'book'}
              title={lesson.title}
              meta={`Lesson ${lesson.position} · ${lesson.level}`}
              state={i === 0 ? 'next' : 'queued'}
              href={`/lesson/${lesson.id}`}
              accentColor={i === 0 ? accentColor : undefined}
              badge={i === 0 ? <Badge tone="brand" dot>Next</Badge> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

> If `Button` doesn't accept an `href` prop, swap for `<Link href="/tracks">View skill tree</Link>` styled with `.btn .btn-ghost .btn-sm` classes.

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- UpNextList
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/UpNextList.tsx tests/dashboard/UpNextList.test.tsx
git commit -m "feat(dashboard): UpNextList derives next 4 lessons"
```

---

### Task W8: `RecentlyCompletedList`

**Files:**
- Create: `components/dashboard/RecentlyCompletedList.tsx`
- Test: `tests/dashboard/RecentlyCompletedList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/RecentlyCompletedList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecentlyCompletedList } from '@/components/dashboard/RecentlyCompletedList';

const TRACK = {
  id: 't1', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '',
  lessonCount: 4, starterRepoUrl: null,
  lessons: [
    { id: 'L1', version: 1, title: 'Optionals', level: 'foundation', summary: '', position: 1 },
    { id: 'L2', version: 1, title: 'Closures',  level: 'foundation', summary: '', position: 2 },
    { id: 'L3', version: 1, title: 'State',     level: 'foundation', summary: '', position: 3 },
    { id: 'L4', version: 1, title: 'Bindings',  level: 'foundation', summary: '', position: 4 },
  ],
};

const PROGRESS = {
  trackId: 't1',
  lessons: [
    { lessonId: 'L1', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-04-28T12:00:00Z' },
    { lessonId: 'L2', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-04-30T12:00:00Z' },
    { lessonId: 'L3', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-05-01T12:00:00Z' },
    { lessonId: 'L4', lessonVersion: 1, totalExercises: 4, passedExercises: 0, attemptedExercises: 0, state: 'not_started' as const, lastAttemptAt: null },
  ],
};

describe('RecentlyCompletedList', () => {
  it('renders last 3 completed lessons sorted by lastAttemptAt desc', () => {
    render(<RecentlyCompletedList track={TRACK} progress={PROGRESS} />);
    const items = screen.getAllByRole('link');
    expect(items[0]).toHaveTextContent('State');
    expect(items[1]).toHaveTextContent('Closures');
    expect(items[2]).toHaveTextContent('Optionals');
  });

  it('renders empty-state when none completed', () => {
    const empty = { trackId: 't1', lessons: [] };
    render(<RecentlyCompletedList track={TRACK} progress={empty} />);
    expect(screen.getByText(/Nothing completed yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- RecentlyCompletedList
```

- [ ] **Step 3: Create the component**

Create `components/dashboard/RecentlyCompletedList.tsx`:

```tsx
import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import { Heading } from '@/components/ui/Heading';
import { Row } from '@/components/ui/Row';
import { Badge } from '@/components/ui/Badge';
import { LessonRow } from './LessonRow';

type Props = {
  track: TrackDetail;
  progress: TrackProgress | undefined;
};

export function RecentlyCompletedList({ track, progress }: Props) {
  const titleById = new Map(track.lessons.map((l) => [l.id, l.title]));
  const completed = (progress?.lessons ?? [])
    .filter((l) => l.state === 'complete' && l.lastAttemptAt !== null)
    .sort((a, b) => Date.parse(b.lastAttemptAt!) - Date.parse(a.lastAttemptAt!))
    .slice(0, 3);

  return (
    <div className="stack" style={{ marginTop: 20 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Heading level="3">Recently completed</Heading>
        <span className="muted" style={{ fontSize: 'var(--t-sm)' }}>This week</span>
      </Row>
      {completed.length === 0 ? (
        <p className="muted">Nothing completed yet — start with today's plan.</p>
      ) : (
        <div className="stack stack-tight">
          {completed.map((p) => (
            <LessonRow
              key={p.lessonId}
              icon="check"
              title={titleById.get(p.lessonId) ?? p.lessonId}
              meta={`Lesson · completed`}
              state="completed"
              href={`/lesson/${p.lessonId}`}
              badge={<Badge tone="success" dot>Done</Badge>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- RecentlyCompletedList
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RecentlyCompletedList.tsx tests/dashboard/RecentlyCompletedList.test.tsx
git commit -m "feat(dashboard): RecentlyCompletedList shows last 3 completions"
```

---

### Task W9: `PathsList`

**Files:**
- Create: `components/dashboard/PathsList.tsx`
- Test: `tests/dashboard/PathsList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/PathsList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PathsList } from '@/components/dashboard/PathsList';

const TRACKS = [
  { id: 'swift', version: 1, title: 'SwiftUI fundamentals', language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Compose fundamentals', language: 'kotlin', kind: 'language', description: '', lessonCount: 18, starterRepoUrl: null },
];

const PROGRESS = new Map<string, any>([
  ['swift',  { trackId: 'swift', lessons: Array.from({ length: 17 }, (_, i) => ({ lessonId: `s${i}`, state: 'complete', lessonVersion: 1, totalExercises: 1, passedExercises: 1, attemptedExercises: 1, lastAttemptAt: '2026-05-01T00:00:00Z' })) }],
  ['kotlin', { trackId: 'kotlin', lessons: Array.from({ length: 6 },  (_, i) => ({ lessonId: `k${i}`, state: 'complete', lessonVersion: 1, totalExercises: 1, passedExercises: 1, attemptedExercises: 1, lastAttemptAt: '2026-05-01T00:00:00Z' })) }],
]);

describe('PathsList', () => {
  it('renders one card per track with correct done/total', () => {
    render(<PathsList tracks={TRACKS} progressByTrack={PROGRESS} />);
    expect(screen.getByText('SwiftUI fundamentals')).toBeInTheDocument();
    expect(screen.getByText('17/24')).toBeInTheDocument();
    expect(screen.getByText('Compose fundamentals')).toBeInTheDocument();
    expect(screen.getByText('6/18')).toBeInTheDocument();
  });

  it('uses iris dot for swift, amber dot for kotlin', () => {
    const { container } = render(<PathsList tracks={TRACKS} progressByTrack={PROGRESS} />);
    const dots = container.querySelectorAll('[data-track-dot]');
    expect(dots[0].getAttribute('data-track-dot')).toBe('iris');
    expect(dots[1].getAttribute('data-track-dot')).toBe('amber');
  });

  it('handles missing progress entry as 0 done', () => {
    const partial = new Map([['swift', PROGRESS.get('swift')!]]);
    render(<PathsList tracks={TRACKS} progressByTrack={partial} />);
    expect(screen.getByText('0/18')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- PathsList
```

- [ ] **Step 3: Create the component**

Create `components/dashboard/PathsList.tsx`:

```tsx
import type { TrackSummary } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Row } from '@/components/ui/Row';

type Props = {
  tracks: TrackSummary[];
  progressByTrack: Map<string, TrackProgress | null>;
};

const TRACK_COLOR: Record<string, { tone: 'iris' | 'amber'; cssVar: string }> = {
  swift:  { tone: 'iris',  cssVar: 'var(--iris-400)' },
  kotlin: { tone: 'amber', cssVar: 'var(--amber-400)' },
};

export function PathsList({ tracks, progressByTrack }: Props) {
  return (
    <div className="stack">
      <Heading level="3">Your paths</Heading>
      <div className="stack stack-tight">
        {tracks.map((t) => {
          const tp = progressByTrack.get(t.id);
          const done = (tp?.lessons ?? []).filter((l) => l.state === 'complete').length;
          const total = t.lessonCount;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const color = TRACK_COLOR[t.language] ?? { tone: 'iris' as const, cssVar: 'var(--peacock-400)' };
          return (
            <Card key={t.id}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <Row style={{ gap: 10 }}>
                  <span
                    data-track-dot={color.tone}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: color.cssVar }}
                  />
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                </Row>
                <span className="mono muted" style={{ fontSize: 'var(--t-xs)' }}>{done}/{total}</span>
              </Row>
              <ProgressBar
                value={pct}
                fillStyle={{ background: `linear-gradient(90deg, ${color.cssVar}, var(--peacock-300))` }}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

> If `ProgressBar` doesn't accept `fillStyle`, replace with the inline `.bar` / `.bar-fill` markup from `components.css` and apply the gradient as inline style on `.bar-fill`.

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- PathsList
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PathsList.tsx tests/dashboard/PathsList.test.tsx
git commit -m "feat(dashboard): PathsList per-track progress cards"
```

---

### Task W10: `MiniLeaderboard`

**Files:**
- Create: `components/dashboard/MiniLeaderboard.tsx`
- Test: `tests/dashboard/MiniLeaderboard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/MiniLeaderboard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MiniLeaderboard } from '@/components/dashboard/MiniLeaderboard';

const ENTRIES = [
  { rank: 1, studentId: 's1', name: 'M. Okafor',     totalPoints: 4280, streak: 14 },
  { rank: 2, studentId: 's2', name: 'T. Patel',      totalPoints: 3940, streak: 12 },
  { rank: 3, studentId: 's3', name: 'S. Lindqvist',  totalPoints: 3210, streak: 10 },
  { rank: 4, studentId: 's4', name: 'A. Karlsson',   totalPoints: 2900, streak: 9 },
  { rank: 7, studentId: 'me', name: 'Jordan Kim',    totalPoints: 1240, streak: 5 },
];

describe('MiniLeaderboard', () => {
  it('renders top-3 plus "you" when user is outside the top-3', () => {
    render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    expect(screen.getByText('M. Okafor')).toBeInTheDocument();
    expect(screen.getByText('T. Patel')).toBeInTheDocument();
    expect(screen.getByText('S. Lindqvist')).toBeInTheDocument();
    expect(screen.getByText(/Jordan Kim/)).toBeInTheDocument();
    expect(screen.queryByText('A. Karlsson')).not.toBeInTheDocument();
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it('does NOT duplicate "you" when user is in the top-3', () => {
    const e = ENTRIES.map((x, i) => i === 0 ? { ...x, studentId: 'me' } : x);
    render(<MiniLeaderboard entries={e} myStudentId="me" />);
    const meRows = screen.queryAllByText(/M\. Okafor/);
    expect(meRows).toHaveLength(1);
  });

  it('applies .lb-rank.top to rank 1', () => {
    const { container } = render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    const ranks = container.querySelectorAll('.lb-rank');
    expect(ranks[0].classList.contains('top')).toBe(true);
    expect(ranks[1].classList.contains('top')).toBe(false);
  });

  it('applies .lb-row.you to current user row', () => {
    const { container } = render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    const youRow = container.querySelector('.lb-row.you');
    expect(youRow).toBeInTheDocument();
    expect(youRow?.textContent).toContain('Jordan Kim');
  });

  it('renders empty-state when no entries', () => {
    render(<MiniLeaderboard entries={[]} myStudentId="me" />);
    expect(screen.getByText(/No leaderboard entries/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- MiniLeaderboard
```

- [ ] **Step 3: Create the component**

Create `components/dashboard/MiniLeaderboard.tsx`:

```tsx
import type { LeaderboardEntry } from '@/lib/gamification';
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';

type Props = { entries: LeaderboardEntry[]; myStudentId: string };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export function MiniLeaderboard({ entries, myStudentId }: Props) {
  if (entries.length === 0) {
    return (
      <Card elevated style={{ marginTop: 8 }}>
        <Heading level="4" style={{ marginBottom: 14 }}>This week's leaderboard</Heading>
        <p className="muted">No leaderboard entries yet.</p>
      </Card>
    );
  }
  const top3 = entries.slice(0, 3);
  const me = entries.find((e) => e.studentId === myStudentId);
  const includesMe = top3.some((e) => e.studentId === myStudentId);
  const rows = !includesMe && me ? [...top3, me] : top3;

  // TODO: Sub-project F adds /leaderboard route — wire a "See all" link here when it exists.
  return (
    <Card elevated style={{ marginTop: 8 }}>
      <Heading level="4" style={{ marginBottom: 14 }}>This week's leaderboard</Heading>
      <div className="stack stack-tight">
        {rows.map((r) => {
          const isMe = r.studentId === myStudentId;
          const isTop = r.rank === 1;
          return (
            <div key={r.studentId} className={cn('lb-row', isMe && 'you')}>
              <div className={cn('lb-rank', isTop && 'top')}>{r.rank}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar size="sm" initials={initials(r.name)} />
                <span style={{ fontSize: 'var(--t-sm)', fontWeight: isMe ? 600 : 500 }}>
                  {r.name}{isMe ? ' (you)' : ''}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>
                {r.totalPoints.toLocaleString()} XP
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

> Verify Avatar's prop is `initials` (not `children`). Check `components/ui/Avatar.tsx` first; adjust if needed.

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- MiniLeaderboard
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/MiniLeaderboard.tsx tests/dashboard/MiniLeaderboard.test.tsx
git commit -m "feat(dashboard): MiniLeaderboard top-3 + you"
```

---

### Task W11: `PageHead`

**Files:**
- Create: `components/dashboard/PageHead.tsx`
- Test: `tests/dashboard/PageHead.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/PageHead.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHead } from '@/components/dashboard/PageHead';
import { dashboardContinueFixture, dashboardExhaustedFixture, dashboardConceptGapFixture } from '@/lib/__fixtures__/dashboard.fixture';

const TRACK = {
  id: 'track-swift', version: 1, title: 'iOS Development with SwiftUI',
  language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null,
  lessons: [],
};

describe('PageHead', () => {
  it('renders eyebrow with track title', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByText('iOS Development with SwiftUI')).toBeInTheDocument();
  });

  it('renders heading with first name', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Jordan.');
  });

  it('renders heading without name when user.name is empty', () => {
    render(<PageHead user={{ id: 'u', name: '' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back.');
  });

  it('shows "Continue lesson NN" copy on continue kind', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('link', { name: /Continue lesson 8/i })).toBeInTheDocument();
  });

  it('shows "Practice {concept}" copy on concept_gap kind', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardConceptGapFixture} track={TRACK} />);
    expect(screen.getByRole('link', { name: /Practice optionals/i })).toBeInTheDocument();
  });

  it('hides Continue CTA on exhausted state, shows Review CTA', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardExhaustedFixture} track={TRACK} />);
    expect(screen.queryByRole('link', { name: /Continue lesson/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All caught up|Review queue/i })).toBeInTheDocument();
  });

  it('renders disabled "Restart streak insurance" button', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    const btn = screen.getByRole('button', { name: /Restart streak insurance/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- PageHead
```

- [ ] **Step 3: Create the component**

Create `components/dashboard/PageHead.tsx`:

```tsx
import Link from 'next/link';
import type { TrackDetail } from '@/lib/tracks';
import type { DashboardData } from '@/lib/gamification';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { Icon } from '@/components/ui/Icon';

type Props = {
  user: { id: string; name?: string | null };
  dash: DashboardData;
  track: TrackDetail;
};

export function PageHead({ user, dash, track }: Props) {
  const firstName = user.name?.split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Welcome back, ${firstName}.` : 'Welcome back.';
  const nudge = nextBadgeNudge(dash) ?? `Keep up the ${dash.streak}-day streak.`;
  return (
    <div className="page-head">
      <div>
        <Eyebrow style={{ marginBottom: 10 }}>{track.title}</Eyebrow>
        <Heading level="1" className="h-display">{greeting}</Heading>
        <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>{nudge}</p>
      </div>
      <Row style={{ gap: 12 }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled
          aria-disabled="true"
          title="Coming soon"
        >
          <Icon name="refresh" size={14} />Restart streak insurance
        </button>
        <PrimaryCta dash={dash} />
      </Row>
    </div>
  );
}

function PrimaryCta({ dash }: { dash: DashboardData }) {
  const plan = dash.todayPlan;
  if (!plan) {
    return (
      <Link href="/review" className="btn btn-iridescent btn-lg">
        <Icon name="play" size={14} />All caught up — review queue
      </Link>
    );
  }
  let label: string;
  switch (plan.recommendationKind) {
    case 'continue':    label = `Continue lesson ${plan.position}`; break;
    case 'concept_gap': label = `Practice ${plan.conceptHint ?? 'concept'}`; break;
    case 'first_timer': label = 'Start lesson 01'; break;
  }
  return (
    <Link href={`/lesson/${plan.lessonId}`} className="btn btn-iridescent btn-lg">
      <Icon name="play" size={14} />{label}
    </Link>
  );
}

// Returns "You're N lessons away from your next badge." or null when no unearned badge has a threshold.
function nextBadgeNudge(dash: DashboardData): string | null {
  // Heuristic: count unearned badges; nearest threshold isn't on the wire, so use raw count as N.
  const unearned = dash.badges.filter((b) => !b.earned).length;
  if (unearned === 0) return null;
  return `You're ${unearned} achievement${unearned === 1 ? '' : 's'} away from your next badge.`;
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- PageHead
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PageHead.tsx tests/dashboard/PageHead.test.tsx
git commit -m "feat(dashboard): PageHead with eyebrow + greeting + dynamic CTA"
```

---

### Task W12: Skeleton + Error states

**Files:**
- Create: `components/dashboard/DashboardSkeleton.tsx`
- Create: `components/dashboard/DashboardError.tsx`

- [ ] **Step 1: Create `DashboardSkeleton.tsx`**

```tsx
export function DashboardSkeleton() {
  return (
    <div className="stack" data-testid="dashboard-skeleton" aria-busy="true">
      <div className="page-head">
        <div>
          <div style={{ width: 220, height: 12, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ width: 320, height: 36, background: 'var(--bg-3)', borderRadius: 6 }} />
        </div>
      </div>
      <div className="daily" style={{ minHeight: 180, opacity: 0.5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, marginTop: 32 }}>
        <div style={{ minHeight: 240, background: 'var(--bg-2)', borderRadius: 8 }} />
        <div style={{ minHeight: 240, background: 'var(--bg-2)', borderRadius: 8 }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `DashboardError.tsx`**

```tsx
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';

type Props = { message: string; onRetry: () => void };

export function DashboardError({ message, onRetry }: Props) {
  return (
    <Card>
      <Heading level="3">Couldn't load dashboard</Heading>
      <p className="muted" style={{ marginTop: 8 }}>{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-primary" style={{ marginTop: 16 }}>
        Retry
      </button>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardSkeleton.tsx components/dashboard/DashboardError.tsx
git commit -m "feat(dashboard): Skeleton + Error fallbacks"
```

---

### Task W13: Refactor `dashboard/page.tsx` orchestrator

**Files:**
- Modify: `app/(authed)/dashboard/page.tsx`
- Test: `tests/dashboard/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard/page.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import DashboardPage from '@/app/(authed)/dashboard/page';
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';
import * as gamLib from '@/lib/gamification';
import * as progLib from '@/lib/progress';
import { dashboardContinueFixture } from '@/lib/__fixtures__/dashboard.fixture';

vi.mock('@/lib/tracks');
vi.mock('@/lib/gamification');
vi.mock('@/lib/progress');
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Jordan Kim' }, loading: false, streak: 12, totalPoints: 1240 }),
}));

const TRACKS = [
  { id: 'swift', version: 1, title: 'iOS Development with SwiftUI', language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Compose fundamentals',          language: 'kotlin', kind: 'language', description: '', lessonCount: 18, starterRepoUrl: null },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
  vi.mocked(tracksLib.fetchTrack).mockResolvedValue({
    ...TRACKS[0],
    lessons: [{ id: 'lesson-state-bindings', version: 1, title: 'State', level: 'foundation', summary: '', position: 8 }],
  });
  vi.mocked(progLib.fetchTrackProgress).mockResolvedValue({ trackId: 'swift', lessons: [] });
  vi.mocked(gamLib.fetchDashboard).mockResolvedValue(dashboardContinueFixture);
  vi.mocked(gamLib.fetchLeaderboard).mockResolvedValue({
    entries: [{ rank: 1, studentId: 's1', name: 'M. Okafor', totalPoints: 4280, streak: 14 }],
    myRank: null,
  });
});

describe('DashboardPage orchestrator', () => {
  it('renders the skeleton initially', () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('renders the dashboard after data loads', async () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => {
      expect(screen.getByText('State, Bindings, and the @State property wrapper')).toBeInTheDocument();
    });
    expect(screen.getByText('iOS Development with SwiftUI')).toBeInTheDocument();
  });

  it('passes the active trackId to fetchDashboard', async () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => expect(vi.mocked(gamLib.fetchDashboard)).toHaveBeenCalledWith('swift'));
  });

  it('renders DashboardError on fetch failure', async () => {
    vi.mocked(gamLib.fetchDashboard).mockRejectedValueOnce(new Error('boom'));
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => expect(screen.getByText("Couldn't load dashboard")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
npm test -- dashboard/page
```

Expected: FAIL — current page composition doesn't match.

- [ ] **Step 3: Refactor the page**

Replace `app/(authed)/dashboard/page.tsx`:

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';
import { fetchDashboard, fetchLeaderboard, type DashboardData, type LeaderboardData } from '@/lib/gamification';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import { fetchTrackProgress, type TrackProgress } from '@/lib/progress';
import { PageHead } from '@/components/dashboard/PageHead';
import { DailyStrip } from '@/components/dashboard/DailyStrip';
import { UpNextList } from '@/components/dashboard/UpNextList';
import { RecentlyCompletedList } from '@/components/dashboard/RecentlyCompletedList';
import { PathsList } from '@/components/dashboard/PathsList';
import { MiniLeaderboard } from '@/components/dashboard/MiniLeaderboard';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardError } from '@/components/dashboard/DashboardError';

const ACCENT: Record<string, string> = {
  swift: 'var(--iris-400)',
  kotlin: 'var(--amber-400)',
};

type Bundle = {
  dash: DashboardData;
  lb: LeaderboardData;
  track: TrackDetail;
  progressByTrack: Map<string, TrackProgress | null>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { trackId, tracks, loading: trackLoading } = useActiveTrack();
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!trackId) return;
    setError(null);
    setData(null);
    try {
      const [dash, lb, track, entries] = await Promise.all([
        fetchDashboard(trackId),
        fetchLeaderboard(),
        fetchTrack(trackId),
        Promise.all(tracks.map((t) => fetchTrackProgress(t.id).then((p) => [t.id, p] as const))),
      ]);
      if (!track) throw new Error('Active track not found');
      setData({ dash, lb, track, progressByTrack: new Map(entries) });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [trackId, tracks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (trackLoading || !trackId) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error} onRetry={loadAll} />;
  if (!data || !user) return <DashboardSkeleton />;

  const accent = ACCENT[data.track.language] ?? 'var(--peacock-400)';

  return (
    <>
      <PageHead user={user} dash={data.dash} track={data.track} />
      <DailyStrip dash={data.dash} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, marginTop: 32 }}>
        <div className="stack">
          <UpNextList track={data.track} progress={data.progressByTrack.get(trackId) ?? undefined} todayPlan={data.dash.todayPlan} accentColor={accent} />
          <RecentlyCompletedList track={data.track} progress={data.progressByTrack.get(trackId) ?? undefined} />
        </div>
        <div className="stack">
          <PathsList tracks={tracks} progressByTrack={data.progressByTrack} />
          <MiniLeaderboard entries={data.lb.entries} myStudentId={user.id} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
npm test -- dashboard/page
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(authed\)/dashboard/page.tsx tests/dashboard/page.test.tsx
git commit -m "feat(dashboard): refactor page to new composition; drop AppShell shim"
```

---

### Task W14: Delete obsolete components

**Files:**
- Delete: `components/dashboard/StatsCard.tsx`, `BadgesGrid.tsx`, `ConceptMastery.tsx`, `ReviewWidget.tsx`, `LeaderboardTable.tsx`
- Delete: corresponding `tests/dashboard/*.test.tsx`

- [ ] **Step 1: Verify no other consumers**

```bash
grep -rEn "from '@/components/dashboard/(StatsCard|BadgesGrid|ConceptMastery|ReviewWidget|LeaderboardTable)'" .
```

Expected: only matches in `tests/dashboard/*.test.tsx` for the same components (no production consumer).

- [ ] **Step 2: Delete the files**

```bash
rm components/dashboard/StatsCard.tsx
rm components/dashboard/BadgesGrid.tsx
rm components/dashboard/ConceptMastery.tsx
rm components/dashboard/ReviewWidget.tsx
rm components/dashboard/LeaderboardTable.tsx
rm tests/dashboard/StatsCard.test.tsx
rm tests/dashboard/BadgesGrid.test.tsx
rm tests/dashboard/ConceptMastery.test.tsx
rm tests/dashboard/ReviewWidget.test.tsx
rm tests/dashboard/LeaderboardTable.test.tsx
```

- [ ] **Step 3: Run lint + tests + build**

```bash
npm run lint && npm test && npm run build
```

Expected: all green. No dangling imports.

- [ ] **Step 4: Commit**

```bash
git add -u components/dashboard/ tests/dashboard/
git commit -m "chore(dashboard): remove StatsCard, BadgesGrid, ConceptMastery, ReviewWidget, LeaderboardTable"
```

---

### Task W15: E2E smoke

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Write the e2e**

Create `tests/e2e/dashboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('dashboard renders the daily strip + paths + leaderboard', async ({ page }) => {
  // Assumes auth state is reused via storage (existing pattern); adjust per project setup.
  await page.goto('/dashboard');

  // Daily strip is present
  await expect(page.locator('.daily')).toBeVisible();

  // Up next has at least one lesson row
  await expect(page.locator('.lesson-row').first()).toBeVisible();

  // Paths list and leaderboard render in the right column
  await expect(page.getByRole('heading', { name: /Your paths/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /This week's leaderboard/i })).toBeVisible();

  // No console errors
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run e2e**

```bash
npx playwright test dashboard.spec
```

Expected: PASS against the running dev server.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/dashboard.spec.ts
git commit -m "test(e2e): dashboard smoke"
```

---

### Task W16: Phase 2 verification + PR + merge

**Files:** none — verification only.

- [ ] **Step 1: Full test suite + lint + build**

```bash
npm run lint && npm test && npm run build
```

Expected: all green.

- [ ] **Step 2: Manual smoke against live platform endpoint**

Confirm platform PR has merged + deployed. In `web/` dev:

```bash
npm run dev
```

Open `http://localhost:3001/dashboard`. Verify:
- Daily strip renders with real today's plan
- Streak / Daily XP / Mastery KPIs show real numbers
- Up Next list contains the right lessons in the right order
- Paths list shows both Swift + Kotlin progress
- Mini leaderboard shows top-3 + you
- Topbar SegmentedControl switches the dashboard's data when toggled
- Sidebar ActiveTrackPill reflects the active track

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/dashboard
gh pr create --title "feat(dashboard): port design's daily strip + paths + mini leaderboard" --body "$(cat <<'EOF'
## Summary
- Refactors `/dashboard` to the design's composition (PageHead, DailyStrip, UpNext, RecentlyCompleted, Paths, MiniLeaderboard)
- Lifts TrackContext (Topbar SegmentedControl + Sidebar ActiveTrackPill now functional)
- Ports missing `app.css` slice (chrome + dashboard styles)
- Deletes 5 retired components (StatsCard, BadgesGrid, ConceptMastery, ReviewWidget, LeaderboardTable)
- Drops AppShell shim usage on dashboard (file kept for other pages)

## Depends on
Platform PR #XXX `feat(dashboard): extended payload for new dashboard UI` — must be merged + deployed first.

## Test plan
- [ ] All Vitest suites green
- [ ] Playwright `dashboard.spec.ts` green
- [ ] Lint + build clean
- [ ] Manual: switch tracks via Topbar, verify dashboard data refetches

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After review, merge with --no-ff**

```bash
git checkout master
git pull
git merge --no-ff feat/dashboard -m "merge: dashboard refactor"
git push origin master
```

---

### Task W17: Merge cleanup chain + vault updates + handover

**Files:**
- Modify: `vault/Decisions/UI Refactor Roadmap.md`
- Modify: `vault/Systems/` (add `Dashboard.md`)
- Modify: `docs/superpowers/HANDOVER.md`
- Modify: `docs/superpowers/NEXT-SESSION-PROMPT.md`

- [ ] **Step 1: Merge web `master` into `feat/adaptive-next-lesson`**

Stay in the web worktree (or switch to the main `web/` checkout).

```bash
cd c:/Users/ricma/BootCamp/web
git checkout feat/adaptive-next-lesson
git status
```

If there are dirty changes, snapshot first:

```bash
git add -A
git commit -m "wip: snapshot before merging master into feat/adaptive-next-lesson"
```

Then merge:

```bash
git merge master -m "merge master into feat/adaptive-next-lesson"
git push origin feat/adaptive-next-lesson
```

- [ ] **Step 2: Check platform for any active WIP branch**

```bash
cd c:/Users/ricma/BootCamp/platform
git branch -a
```

If a WIP branch exists, repeat the snapshot + merge pattern with platform `master` → that branch.

- [ ] **Step 3: Update `vault/Decisions/UI Refactor Roadmap.md`**

In the table, change row C's Status from `Next` to `Done (merged 2026-05-02 at web `master` `<sha>` and platform `master` `<sha>`)`. Set row D's Status to `Next`.

In the "Carry-overs into next sub-projects" section, remove the TrackContext bullet (now closed) and update the ContinueLessonButton bullet to call out that web's recommendation endpoint now supports `?trackId=`.

- [ ] **Step 4: Create `vault/Systems/Dashboard.md`**

```md
# Dashboard

## Purpose

The /dashboard route — landing page for authed users. Sub-project C of the UI refactor.

## Owns

- web/app/(authed)/dashboard/page.tsx — orchestrator
- web/components/dashboard/{PageHead,DailyStrip,LessonRow,UpNextList,RecentlyCompletedList,PathsList,MiniLeaderboard,DashboardSkeleton,DashboardError}.tsx
- web/lib/track-context.tsx — TrackProvider + useActiveTrack hook
- platform/src/gamification/{mastery,daily-xp,today-plan}.service.ts — backend mechanics
- platform/src/content/services/lesson-insight.service.ts — duration + type-label helpers

## Key Interfaces

- GET /api/dashboard/me?trackId= → DashboardResponse with streak, dailyXp, mastery, todayPlan
- useActiveTrack() → { trackId, setTrackId, tracks, loading }
- LessonRow primitive consumed by UpNext and RecentlyCompleted
- localStorage key bootcamp.activeTrackId persists active-track choice

## Dependencies

- TrackContext mounts inside (authed)/layout.tsx; consumed by Topbar + ActiveTrackPill (chrome)
- Backend services live in gamification module; LessonInsightService is exported from content module

## Carry-overs to D and beyond

- TrackContext is in place; D consumes it for the skill tree
- Sidebar ContinueLessonButton still hardcodes /tracks; future sub-project may unify with todayPlan
- Per-cohort DAILY_XP_TARGET configurability deferred
```

- [ ] **Step 5: Update `docs/superpowers/HANDOVER.md` and `NEXT-SESSION-PROMPT.md`**

In `HANDOVER.md`, append a Sub-project C entry summarising scope, both PR shas, and the new files.

Replace the body of `NEXT-SESSION-PROMPT.md` to point at Sub-project D (Tracks / Skill Tree). Update:
- "What's already shipped" — add C's bullets (TrackContext live, dashboard refactored, both repos)
- "Today's task" — change to Sub-project D
- "Past sub-projects" — append C with the new shas

- [ ] **Step 6: Commit vault + docs updates (where tracked)**

The BootCamp root isn't a git repo, so vault and docs/superpowers files are written but not committed (consistent with A/B). The HANDOVER and NEXT-SESSION-PROMPT updates are file-system only.

If `vault/` lives in its own repo, commit there:

```bash
cd c:/Users/ricma/BootCamp/vault && git status 2>&1
# if a repo, add + commit the new Dashboard.md and roadmap edit
```

- [ ] **Step 7: Done**

Sub-project C complete. Sidebar Continue Lesson and Lesson navigation broader unification remain as carry-overs for E or later.

---

## Self-Review

### Spec coverage check

- D1 TrackContext lift → Tasks W2 (provider) + W3 (chrome wiring). ✓
- D2 Backend payload extension → Tasks P1-P10. ✓
  - Mastery curve P1; lesson-insight P2; sumPointsSince P3; DailyXp P4; streak P5; today-plan P8; recommendation trackId P6 + P7; controller P10. ✓
- D3 Dashboard CTA dynamic → Task W11 (PageHead has `PrimaryCta` with kind branching). ✓
- D4 Replace LeaderboardTable → Task W10 (MiniLeaderboard) + W14 (delete). ✓
- D5 Delete 3 widgets + StatsCard → Task W14. ✓
- D6 Drop AppShell shim on dashboard → Task W13 (refactored page does not import AppShell). ✓
- D7 CSS port → Task W1. ✓
- D8 Two repos, two PRs ordered → R0 (worktrees) + Phase 1 + Phase 2 + W17 (merge chain). ✓
- TodayPlan with conceptHint field → P8 service + W4 type widening. ✓
- PageHead firstName fallback → W11 test asserts both branches. ✓
- DAILY_XP_TARGET = 20 baked → P4. ✓
- Lesson type label heuristic → P2. ✓
- Triangular curve constants → P1 boundary table. ✓
- UTC day window → P4 + P5. ✓
- "+1 today" delta → P5 + W6 test. ✓
- Restart streak insurance disabled button → W11 test asserts disabled + aria-disabled. ✓

### Placeholder scan

- Searched plan for "TBD", "TODO", "implement later" — only intentional code-level breadcrumbs remain (`// TODO: Sub-project F adds /leaderboard route` in MiniLeaderboard, `// TODO: Sub-project F adds /leaderboard route — wire a "See all" link` in same file). ✓
- "Add appropriate error handling" — none. ✓
- All test code is concrete; all implementations are concrete. ✓

### Type consistency

- `DashboardData` (web) field names match `DashboardResponse` (platform): `streak, streakIncrementedToday, badges, rank, totalPoints, pointsEarnedToday, dailyXp, mastery, todayPlan`. ✓
- `TodayPlan` shape identical: `lessonId, lessonVersion, trackId, trackTitle, title, position, estimatedMinutes, typeLabel, recommendationKind, reasonMessage, conceptHint`. ✓
- `MasteryProgress`: `level, xpInLevel, xpForNextLevel`. Web type matches platform return. ✓
- `LessonRow` props: `icon, title, meta, state, href, badge?, accentColor?`. Used identically in W7 (UpNextList) and W8 (RecentlyCompletedList). ✓
- `useActiveTrack()` return: `{ trackId, setTrackId, tracks, loading }` — consistent across W2 (provider), W3 (Topbar), W3 (ActiveTrackPill), W13 (DashboardPage). ✓
- `getRecommendation(studentId, trackId?)` signature consistent across P6, P7, P8, P10. ✓

No issues found.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-02-dashboard-plan.md`

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
