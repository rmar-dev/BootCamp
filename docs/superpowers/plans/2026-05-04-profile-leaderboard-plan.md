# Profile + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two new authenticated routes — `/profile` and `/leaderboard` — under the `(authed)/(shell)` route group, backed by a new `GET /api/profile/me` endpoint and an extended `GET /api/leaderboard?period=` endpoint.

**Architecture:** Two-repo, platform-first. Platform extends the existing `gamification` module with profile composition + leaderboard period filter + league derivation; no schema changes, no new modules. Web adds two new pages composed of presentational components reusing the design bundle's `.profile-head`, `.heat-cell`, `.medal`, and `.lb-row` styles. Static refresh on mount; period filter via `?period=` URL param.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL on platform; Next.js 14 App Router + Tailwind + Vitest + Playwright on web. Co-author trailer for every commit: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

**Spec:** [docs/superpowers/specs/2026-05-04-profile-leaderboard-design.md](../specs/2026-05-04-profile-leaderboard-design.md)

---

## Phase 0 — Worktree setup

### Task 1: Create platform worktree on `feat/profile-payload`

**Files:** none (git operation only)

- [ ] **Step 1: Create worktree**

```powershell
git -C c:/Users/ricma/BootCamp/platform worktree add -b feat/profile-payload c:/tmp/bootcamp-platform-profile master
```

Expected: new worktree at `c:/tmp/bootcamp-platform-profile` on branch `feat/profile-payload`. (Note: platform repo has no remote configured, so branch off local `master`, NOT `origin/master`.)

- [ ] **Step 2: Verify branch base SHA**

```powershell
git -C c:/tmp/bootcamp-platform-profile rev-parse HEAD
```

Expected: `bbf4f5f...` (platform master per spec).

- [ ] **Step 3: Copy `.env` from main checkout**

```bash
cp c:/Users/ricma/BootCamp/platform/.env c:/tmp/bootcamp-platform-profile/.env
```

- [ ] **Step 4: Install dependencies**

```powershell
cd c:/tmp/bootcamp-platform-profile; npm install
```

Expected: install completes. node_modules ready for tests. May surface ~14 pre-existing audit advisories — not blocking.

- [ ] **Step 5: Verify postgres is reachable**

```powershell
docker ps --filter name=bootcamp-postgres --format "{{.Status}}"
```

If empty (container stopped), start it: `docker start bootcamp-postgres`. Expected: container is `Up`.

---

## Phase 1 — Platform changes (`feat/profile-payload`)

All Phase 1 work happens in `c:/tmp/bootcamp-platform-profile`. Test commands always set the env vars explicitly because jest doesn't auto-load `.env`:

```powershell
DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest <path>
```

### Task 2: Add `deriveLeague` helper

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/league.util.ts`
- Test: `c:/tmp/bootcamp-platform-profile/src/gamification/league.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/gamification/league.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { deriveLeague } from './league.util';

describe('deriveLeague', () => {
  it('returns Bronze for level 1-2 with xpToNext to Silver', () => {
    expect(deriveLeague(1, 0)).toEqual({ name: 'Bronze', xpToNext: 300, nextLeague: 'Silver' });
    expect(deriveLeague(2, 100)).toEqual({ name: 'Bronze', xpToNext: 200, nextLeague: 'Silver' });
  });

  it('returns Silver for level 3-4', () => {
    expect(deriveLeague(3, 300)).toEqual({ name: 'Silver', xpToNext: 700, nextLeague: 'Gold' });
    expect(deriveLeague(4, 600)).toEqual({ name: 'Silver', xpToNext: 400, nextLeague: 'Gold' });
  });

  it('returns Gold for level 5-6', () => {
    expect(deriveLeague(5, 1000)).toEqual({ name: 'Gold', xpToNext: 1100, nextLeague: 'Sapphire' });
    expect(deriveLeague(6, 1500)).toEqual({ name: 'Gold', xpToNext: 600, nextLeague: 'Sapphire' });
  });

  it('returns Sapphire for level 7-9', () => {
    expect(deriveLeague(7, 2100)).toEqual({ name: 'Sapphire', xpToNext: 2400, nextLeague: 'Peacock' });
    expect(deriveLeague(9, 3600)).toEqual({ name: 'Sapphire', xpToNext: 900, nextLeague: 'Peacock' });
  });

  it('returns Peacock for level 10+, top tier with xpToNext = 0 and nextLeague = null', () => {
    expect(deriveLeague(10, 4500)).toEqual({ name: 'Peacock', xpToNext: 0, nextLeague: null });
    expect(deriveLeague(15, 9000)).toEqual({ name: 'Peacock', xpToNext: 0, nextLeague: null });
  });

  it('clamps negative xpToNext to 0 when totalPoints already exceeds the next-tier minXP', () => {
    // Edge: a student at level 4 with 1500 XP (would normally be level 6).
    // The level passed in is authoritative; if the points overshoot the next tier, xpToNext clamps to 0.
    expect(deriveLeague(4, 1500)).toEqual({ name: 'Silver', xpToNext: 0, nextLeague: 'Gold' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/league.util.spec.ts
```

Expected: FAIL — `Cannot find module './league.util'`.

- [ ] **Step 3: Implement**

```ts
// src/gamification/league.util.ts
export type LeagueName = 'Bronze' | 'Silver' | 'Gold' | 'Sapphire' | 'Peacock';

export type LeagueDerivation = {
  name: LeagueName;
  xpToNext: number;
  nextLeague: LeagueName | null;
};

const TIERS: ReadonlyArray<{ name: LeagueName; minLevel: number; minXP: number }> = [
  { name: 'Peacock',  minLevel: 10, minXP: 4500 },
  { name: 'Sapphire', minLevel: 7,  minXP: 2100 },
  { name: 'Gold',     minLevel: 5,  minXP: 1000 },
  { name: 'Silver',   minLevel: 3,  minXP:  300 },
  { name: 'Bronze',   minLevel: 1,  minXP:    0 },
];

export function deriveLeague(level: number, totalPoints: number): LeagueDerivation {
  // Find the highest tier the student qualifies for by level.
  const idx = TIERS.findIndex((t) => level >= t.minLevel);
  const current = TIERS[idx] ?? TIERS[TIERS.length - 1];
  const next = idx > 0 ? TIERS[idx - 1] : null;
  return {
    name: current.name,
    xpToNext: next ? Math.max(0, next.minXP - totalPoints) : 0,
    nextLeague: next?.name ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/league.util.spec.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/league.util.ts src/gamification/league.util.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(gamification): add deriveLeague helper for 5-tier league

Pure derivation: takes mastery.level + totalPoints, returns
{ name, xpToNext, nextLeague }. 5 tiers (Bronze/Silver/Gold/
Sapphire/Peacock) keyed off mastery.level boundaries 1/3/5/7/10.
xpToNext is the lifetime-XP gap to the next tier's minXP, clamped
non-negative; top tier returns 0/null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3: Add `computeWindowStart` + `parsePeriod` helpers

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/leaderboard-period.util.ts`
- Test: `c:/tmp/bootcamp-platform-profile/src/gamification/leaderboard-period.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/gamification/leaderboard-period.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { parsePeriod, computeWindowStart, LeaderboardPeriod } from './leaderboard-period.util';

describe('parsePeriod', () => {
  it('returns the input when valid', () => {
    expect(parsePeriod('weekly')).toBe('weekly');
    expect(parsePeriod('monthly')).toBe('monthly');
    expect(parsePeriod('all-time')).toBe('all-time');
  });

  it('defaults to weekly for invalid or undefined', () => {
    expect(parsePeriod(undefined)).toBe('weekly');
    expect(parsePeriod('')).toBe('weekly');
    expect(parsePeriod('lifetime')).toBe('weekly');
  });
});

describe('computeWindowStart', () => {
  // Wednesday 2026-05-06 at 14:30 UTC
  const wed = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));

  it('returns most recent Monday 00:00 UTC for weekly', () => {
    const start = computeWindowStart('weekly', wed);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });

  it('returns 1st of current month 00:00 UTC for monthly', () => {
    const start = computeWindowStart('monthly', wed);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 1, 0, 0, 0)));
  });

  it('returns null for all-time', () => {
    expect(computeWindowStart('all-time', wed)).toBeNull();
  });

  it('handles Monday correctly (returns the same Monday at 00:00 UTC)', () => {
    const mon = new Date(Date.UTC(2026, 4, 4, 14, 30, 0));
    const start = computeWindowStart('weekly', mon);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });

  it('handles Sunday correctly (returns previous Monday)', () => {
    const sun = new Date(Date.UTC(2026, 4, 10, 23, 59, 0));
    const start = computeWindowStart('weekly', sun);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/leaderboard-period.util.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/gamification/leaderboard-period.util.ts
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all-time';

const VALID: ReadonlyArray<LeaderboardPeriod> = ['weekly', 'monthly', 'all-time'];

export function parsePeriod(input: string | undefined): LeaderboardPeriod {
  return VALID.includes(input as LeaderboardPeriod) ? (input as LeaderboardPeriod) : 'weekly';
}

export function computeWindowStart(period: LeaderboardPeriod, now: Date = new Date()): Date | null {
  if (period === 'all-time') return null;
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  }
  // weekly: most recent Monday 00:00 UTC.
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}
```

- [ ] **Step 4: Run test to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/leaderboard-period.util.spec.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/leaderboard-period.util.ts src/gamification/leaderboard-period.util.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(gamification): add leaderboard period helpers

parsePeriod normalises the ?period= query (defaults to weekly on
invalid input). computeWindowStart returns the lower bound of the
aggregation window: most-recent-Monday-00:00-UTC for weekly,
1st-of-month-00:00-UTC for monthly, null for all-time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Add `toBucket` heat-strip helper

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/heat-bucket.util.ts`
- Test: `c:/tmp/bootcamp-platform-profile/src/gamification/heat-bucket.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/gamification/heat-bucket.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { toBucket } from './heat-bucket.util';

describe('toBucket', () => {
  it('returns 0 for zero activity', () => {
    expect(toBucket(0)).toBe(0);
  });

  it('returns 1 for exactly 1 activity', () => {
    expect(toBucket(1)).toBe(1);
  });

  it('returns 2 for 2-3 activities', () => {
    expect(toBucket(2)).toBe(2);
    expect(toBucket(3)).toBe(2);
  });

  it('returns 3 for 4-6 activities', () => {
    expect(toBucket(4)).toBe(3);
    expect(toBucket(6)).toBe(3);
  });

  it('returns 4 for 7+ activities', () => {
    expect(toBucket(7)).toBe(4);
    expect(toBucket(50)).toBe(4);
  });

  it('treats negative input defensively as 0', () => {
    expect(toBucket(-1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/heat-bucket.util.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/gamification/heat-bucket.util.ts
export function toBucket(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}
```

- [ ] **Step 4: Run test to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/heat-bucket.util.spec.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/heat-bucket.util.ts src/gamification/heat-bucket.util.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(gamification): add toBucket helper for heat-strip intensity

Maps a daily activity count to a 0-4 intensity bucket:
0 → 0, 1 → 1, 2-3 → 2, 4-6 → 3, 7+ → 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Add `buildHeatStrip` helper

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/heat-strip.util.ts`
- Test: `c:/tmp/bootcamp-platform-profile/src/gamification/heat-strip.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/gamification/heat-strip.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { buildHeatStrip, HEAT_STRIP_DAYS, startOfHeatStrip } from './heat-strip.util';

describe('startOfHeatStrip', () => {
  it('returns 26*7 - 1 days before now at UTC midnight', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));
    const start = startOfHeatStrip(now);
    // Today (2026-05-06) is day 181; the strip starts at day 0 = 181 days earlier.
    const expected = new Date(Date.UTC(2026, 4, 6, 0, 0, 0));
    expected.setUTCDate(expected.getUTCDate() - (HEAT_STRIP_DAYS - 1));
    expect(start).toEqual(expected);
  });
});

describe('buildHeatStrip', () => {
  const now = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));
  const start = startOfHeatStrip(now);

  it('returns 182 zeros for empty input', () => {
    const cells = buildHeatStrip([], start, now);
    expect(cells).toHaveLength(182);
    expect(cells.every((v) => v === 0)).toBe(true);
  });

  it('places a single attempt on the correct day', () => {
    // 5 days before today → day index 176 (since today is index 181).
    const ts = new Date(now);
    ts.setUTCDate(ts.getUTCDate() - 5);
    const cells = buildHeatStrip([{ submittedAt: ts }], start, now);
    expect(cells[176]).toBe(1);
    expect(cells[175]).toBe(0);
    expect(cells[177]).toBe(0);
  });

  it('buckets multiple attempts on the same day', () => {
    const ts = new Date(now);
    ts.setUTCDate(ts.getUTCDate() - 1);
    const events = Array.from({ length: 5 }, () => ({ submittedAt: ts }));
    const cells = buildHeatStrip(events, start, now);
    // 5 activities → bucket 3
    expect(cells[180]).toBe(3);
  });

  it('drops attempts before the window', () => {
    const tooOld = new Date(start);
    tooOld.setUTCDate(tooOld.getUTCDate() - 1);
    const cells = buildHeatStrip([{ submittedAt: tooOld }], start, now);
    expect(cells.every((v) => v === 0)).toBe(true);
  });

  it('places an attempt on the first day of the window correctly', () => {
    const cells = buildHeatStrip([{ submittedAt: start }], start, now);
    expect(cells[0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/heat-strip.util.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/gamification/heat-strip.util.ts
import { toBucket } from './heat-bucket.util';

export const HEAT_STRIP_DAYS = 26 * 7;  // 182

export function startOfHeatStrip(now: Date = new Date()): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - (HEAT_STRIP_DAYS - 1));
  return start;
}

export type HeatStripEvent = { submittedAt: Date };

export function buildHeatStrip(
  events: ReadonlyArray<HeatStripEvent>,
  start: Date,
  now: Date,
): number[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const startMs = start.getTime();
  const counts = new Array<number>(HEAT_STRIP_DAYS).fill(0);
  for (const e of events) {
    const idx = Math.floor((e.submittedAt.getTime() - startMs) / dayMs);
    if (idx < 0 || idx >= HEAT_STRIP_DAYS) continue;
    counts[idx] += 1;
  }
  return counts.map((n) => toBucket(n));
}
```

- [ ] **Step 4: Run test to verify pass**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx jest src/gamification/heat-strip.util.spec.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/heat-strip.util.ts src/gamification/heat-strip.util.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(gamification): add buildHeatStrip helper

Composes a 182-element bucketed heat strip from a list of
submitted-at events. Uses startOfHeatStrip(now) as the day-0
boundary; events outside the window are dropped. Each day's
count is bucketed via toBucket() (0/1/2-3/4-6/7+).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Extract badge-composition helper

**Files:**
- Modify: `c:/tmp/bootcamp-platform-profile/src/gamification/badge.service.ts`
- Modify: `c:/tmp/bootcamp-platform-profile/src/gamification/dashboard.controller.ts`
- Test: `c:/tmp/bootcamp-platform-profile/test/gamification/badge.service.spec.ts` (extend existing)

The dashboard inlines `BADGES.map(...)` + `badgeRepo.findByStudent(...)` to compose `BadgeStatus[]`. Profile needs the same shape. Extract into `BadgeService.listForStudent(studentId)`.

- [ ] **Step 1: Write the failing test**

Append to `test/gamification/badge.service.spec.ts`:

```ts
describe('BadgeService.listForStudent', () => {
  it('returns every defined badge with earned/earnedAt computed from StudentBadge rows', async () => {
    const studentId = await seedStudent();
    const earnedAt = new Date('2026-04-19T10:00:00Z');
    await prisma.studentBadge.create({
      data: { id: newId(), studentId, badgeId: 'first_lesson', earnedAt },
    });

    const list = await badgeService.listForStudent(studentId);

    expect(list.length).toBe(BADGES.length);
    const firstLesson = list.find((b) => b.id === 'first_lesson');
    expect(firstLesson).toBeDefined();
    expect(firstLesson!.earned).toBe(true);
    expect(firstLesson!.earnedAt).toEqual(earnedAt);

    // Every other badge should be unearned.
    const others = list.filter((b) => b.id !== 'first_lesson');
    expect(others.every((b) => b.earned === false)).toBe(true);
    expect(others.every((b) => b.earnedAt === undefined)).toBe(true);
  });
});
```

Adapt `seedStudent` / `BADGES` import to match the file's existing test pattern (read `test/gamification/badge.service.spec.ts` first).

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/badge.service.spec.ts
```

Expected: FAIL — `listForStudent` does not exist.

- [ ] **Step 3: Add `listForStudent` to `BadgeService`**

In `src/gamification/badge.service.ts`:

```ts
import { BADGES } from './badge.definitions';
import { StudentBadge } from '@prisma/client';

export type BadgeStatus = BadgeDefinition & { earned: boolean; earnedAt?: Date };

// ... existing class members
async listForStudent(studentId: string): Promise<BadgeStatus[]> {
  const earned = await this.repository.findByStudent(studentId);
  const earnedMap = new Map<string, StudentBadge>(
    earned.map((b) => [b.badgeId, b]),
  );
  return BADGES.map((b) => {
    const e = earnedMap.get(b.id);
    return { ...b, earned: !!e, earnedAt: e?.earnedAt };
  });
}
```

If `BadgeStatus` type already lives in `dashboard.controller.ts`, move it to `badge.service.ts` and re-export from the controller for backwards compat:

```ts
// dashboard.controller.ts (top of file, replacing the local type def)
export type { BadgeStatus } from './badge.service';
```

- [ ] **Step 4: Refactor dashboard to use the new method**

In `src/gamification/dashboard.controller.ts`, replace the inline composition (lines ~76-84) with:

```ts
const badges = await this.badgeService.listForStudent(studentId);
```

The `badgeRepo` import + the `earnedMap` block + the `BADGES.map` block all go away. Keep the rest of the dashboard logic unchanged.

- [ ] **Step 5: Run tests**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npm run test
```

Expected: full suite green (361 + 1 new). The dashboard tests should still pass since the behavior is unchanged.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/badge.service.ts src/gamification/dashboard.controller.ts test/gamification/badge.service.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
refactor(gamification): extract BadgeService.listForStudent

Lifts the inlined BADGES.map(...) composition out of
DashboardController so ProfileService can reuse it. BadgeStatus
type moves alongside; dashboard re-exports it for back-compat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Extend `LeaderboardController` with `?period=` and `myLeague`

**Files:**
- Modify: `c:/tmp/bootcamp-platform-profile/src/gamification/leaderboard.controller.ts`
- Test: `c:/tmp/bootcamp-platform-profile/test/gamification/leaderboard.controller.spec.ts` (extend existing)

- [ ] **Step 1: Write the failing tests**

Append to the existing leaderboard spec:

```ts
it('GET /api/leaderboard?period=weekly sums Attempt.pointsAwarded over the current week', async () => {
  const cookie = await getAuthCookie();
  // Seed two students; make student-1 active this week, student-2 active last week.
  // Assert student-1 ranks above student-2 in weekly view.
  // ... (adapt seeders to existing pattern)
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=weekly')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.period).toBe('weekly');
  expect(res.body.entries[0].rank).toBe(1);
  expect(res.body.scope).toBeDefined();
});

it('GET /api/leaderboard?period=monthly aggregates the full month', async () => {
  const cookie = await getAuthCookie();
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=monthly')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.period).toBe('monthly');
});

it('GET /api/leaderboard?period=all-time uses ExerciseResult.pointsEarned (existing behavior)', async () => {
  const cookie = await getAuthCookie();
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=all-time')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.period).toBe('all-time');
});

it('returns myLeague derived from my mastery.level', async () => {
  const cookie = await getAuthCookie();
  // Seed self with enough XP to land in Silver (300+).
  // ... seeder
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=weekly')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.myLeague).toBeDefined();
  expect(res.body.myLeague.name).toMatch(/^(Bronze|Silver|Gold|Sapphire|Peacock)$/);
});

it('auto-scopes to my cohort when authenticated student has cohortId', async () => {
  const { cookie, cohortId } = await registerStudentInCohort('Spring2026');
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=weekly')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.scope).toBe('cohort');
  expect(res.body.cohortName).toBe('Spring2026');
});

it('falls back to global scope when authenticated user has no cohort', async () => {
  // Register an instructor / admin / cohort-less account.
  const cookie = await getInstructorCookie();
  const res = await request(app.getHttpServer())
    .get('/api/leaderboard?period=weekly')
    .set('Cookie', cookie)
    .expect(200);
  expect(res.body.scope).toBe('global');
  expect(res.body.cohortName).toBeNull();
});
```

Adapt seeders / `registerStudentInCohort` to whatever pattern the file already uses. Read the file first.

- [ ] **Step 2: Run tests to verify failure**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/leaderboard.controller.spec.ts
```

Expected: FAIL on the new tests (period/myLeague/scope/cohortName fields don't exist on the response).

- [ ] **Step 3: Refactor `LeaderboardController`**

```ts
// src/gamification/leaderboard.controller.ts
import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { StreakService } from './streak.service';
import { MasteryService } from './mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { parsePeriod, computeWindowStart, LeaderboardPeriod } from './leaderboard-period.util';
import { deriveLeague, LeagueDerivation } from './league.util';

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  initials: string;
  language: 'swift' | 'kotlin' | null;
  totalPoints: number;
  streak: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myLeague: LeagueDerivation | null;
  scope: 'cohort' | 'global';
  cohortName: string | null;
};

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(
    private readonly students: StudentRepository,
    private readonly results: ExerciseResultRepository,
    private readonly streak: StreakService,
    private readonly mastery: MasteryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(
    @CurrentUser() user: { userId: string; role: string },
    @Query('period') periodInput?: string,
    @Query('cohortId') cohortIdInput?: string,
  ): Promise<LeaderboardResponse> {
    const period = parsePeriod(periodInput);
    const myStudent = await this.students.findByUserId(user.userId);

    // Resolve scope per the precedence in the spec.
    const { cohortId, scope, cohortName } = await this.resolveScope({
      myStudent, role: user.role, requestedCohortId: cohortIdInput,
    });

    const allStudents = cohortId
      ? await this.students.findByCohort(cohortId)
      : await this.students.findAll();
    const studentIds = allStudents.map((s) => s.id);
    if (studentIds.length === 0) {
      return { period, entries: [], myRank: null, myLeague: null, scope, cohortName };
    }

    const windowStart = computeWindowStart(period);
    const totals = windowStart === null
      ? await this.prisma.exerciseResult.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds } },
          _sum: { pointsEarned: true },
        })
      : await this.prisma.attempt.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds }, submittedAt: { gte: windowStart } },
          _sum: { pointsAwarded: true },
        });
    const pointsMap = new Map(
      totals.map((t) => [t.studentId, (windowStart === null ? t._sum.pointsEarned : t._sum.pointsAwarded) ?? 0]),
    );

    const myStudentId = myStudent?.id ?? null;
    const entries = await Promise.all(allStudents.map(async (s) => ({
      studentId: s.id,
      name: s.name,
      initials: deriveInitials(s.name),
      language: pickStudentLanguage(s),  // see helper below
      totalPoints: pointsMap.get(s.id) ?? 0,
      streak: (await this.streak.getCurrentStreak(s.id)).current,
      isMe: s.id === myStudentId,
    })));
    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    const limited = entries.slice(0, 50);
    const ranked: LeaderboardEntry[] = limited.map((e, i) => ({ ...e, rank: i + 1 }));

    const myRank = myStudentId ? (ranked.find((e) => e.studentId === myStudentId)?.rank ?? null) : null;

    let myLeague: LeagueDerivation | null = null;
    if (myStudent) {
      const myLifetimeAgg = await this.prisma.exerciseResult.aggregate({
        where: { studentId: myStudent.id },
        _sum: { pointsEarned: true },
      });
      const myLifetime = myLifetimeAgg._sum.pointsEarned ?? 0;
      const myLevel = this.mastery.getProgress(myLifetime).level;
      myLeague = deriveLeague(myLevel, myLifetime);
    }

    return { period, entries: ranked, myRank, myLeague, scope, cohortName };
  }

  private async resolveScope(opts: {
    myStudent: Awaited<ReturnType<StudentRepository['findByUserId']>>;
    role: string;
    requestedCohortId?: string;
  }): Promise<{ cohortId: string | null; scope: 'cohort' | 'global'; cohortName: string | null }> {
    // 1. Explicit ?cohortId= with access.
    if (opts.requestedCohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: opts.requestedCohortId } });
      if (!cohort) throw new ForbiddenException('You do not have access to this cohort leaderboard');
      const isInstructor = cohort.instructorId === opts.myStudent?.userId || opts.role === 'admin';
      const isStudent = opts.myStudent?.cohortId === opts.requestedCohortId;
      if (!isInstructor && !isStudent) {
        throw new ForbiddenException('You do not have access to this cohort leaderboard');
      }
      return { cohortId: cohort.id, scope: 'cohort', cohortName: cohort.name };
    }
    // 2. Auto-scope from authenticated student's cohortId.
    if (opts.myStudent?.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: opts.myStudent.cohortId } });
      if (cohort) return { cohortId: cohort.id, scope: 'cohort', cohortName: cohort.name };
    }
    // 3. Global fallback.
    return { cohortId: null, scope: 'global', cohortName: null };
  }
}

// Top-of-file helpers
function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function pickStudentLanguage(student: { /* ... */ }): 'swift' | 'kotlin' | null {
  // V1: derive from the most-recently-attempted exercise's track language.
  // For the initial implementation, return null and refine later — language is decorative
  // (drives avatar tint on the leaderboard), not load-bearing.
  return null;
}
```

If `Cohort` model doesn't have `name` field, use `id` as the display name or extend the schema. Verify by reading `prisma/schema.prisma`.

If `findByCohort` doesn't exist on `StudentRepository`, add it (one-line method using `this.prisma.student.findMany({ where: { cohortId } })`).

- [ ] **Step 4: Update `GamificationModule` to inject `MasteryService`**

In `src/gamification/gamification.module.ts`, confirm `MasteryService` is in the providers list and exported (it should be; if not, add).

- [ ] **Step 5: Run tests**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npm run test
```

Expected: full suite green.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/leaderboard.controller.ts src/gamification/gamification.module.ts test/gamification/leaderboard.controller.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(leaderboard): add ?period= filter, myLeague, cohort auto-scope

GET /api/leaderboard now accepts ?period=weekly|monthly|all-time
(default weekly). Weekly/monthly aggregate Attempt.pointsAwarded
over the period window; all-time keeps the existing
ExerciseResult.pointsEarned aggregation. Response gains myLeague
(derived via deriveLeague), scope ('cohort' | 'global') and
cohortName. Cohort scope precedence: explicit ?cohortId= override
(if access granted) → auto myStudent.cohortId → global fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: Add `ProfileService.composeProfile`

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/profile.service.ts`
- Test: `c:/tmp/bootcamp-platform-profile/test/gamification/profile.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/gamification/profile.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { ProfileService } from '../../src/gamification/profile.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('ProfileService.composeProfile', () => {
  let app: INestApplication;
  let svc: ProfileService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    svc = m.get(ProfileService);
    prisma = m.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(prisma); });

  it('returns account, KPIs, heatStrip[182], skills (per-track), badges for a seeded student', async () => {
    const userId = newId();
    await prisma.user.create({ data: { id: userId, email: 'p@test.com', name: 'P Tester', role: 'student' } });
    const studentId = newId();
    await prisma.student.create({ data: { id: studentId, userId, name: 'P Tester', email: 'p@test.com' } });

    // Seed an attempt so the student appears active.
    const exId = newId();
    // ... seed an exercise + lesson + track using existing helpers
    await prisma.attempt.create({ data: {
      id: newId(), studentId, exerciseId: exId, exerciseVersion: 1,
      submittedAt: new Date(),
      submissionPayload: {} as any,
      passed: true, hintsUsedCount: 0, failedAttemptsBefore: 0, pointsAwarded: 50,
    }});

    const profile = await svc.composeProfile(studentId);
    expect(profile.account.studentId).toBe(studentId);
    expect(profile.account.name).toBe('P Tester');
    expect(profile.account.email).toBe('p@test.com');
    expect(profile.account.level).toBeGreaterThanOrEqual(1);
    expect(profile.heatStrip).toHaveLength(182);
    expect(profile.heatStrip[181]).toBeGreaterThan(0);  // today
    expect(profile.kpis.totalPoints).toBeGreaterThan(0);
    expect(profile.skills.length).toBeGreaterThanOrEqual(0);
    expect(profile.badges.length).toBeGreaterThan(0);  // BADGES const is non-empty
  });

  it('returns empty heat strip and zero KPIs for a brand-new student', async () => {
    const userId = newId();
    await prisma.user.create({ data: { id: userId, email: 'n@test.com', name: 'New', role: 'student' } });
    const studentId = newId();
    await prisma.student.create({ data: { id: studentId, userId, name: 'New', email: 'n@test.com' } });

    const profile = await svc.composeProfile(studentId);
    expect(profile.heatStrip.every((v) => v === 0)).toBe(true);
    expect(profile.kpis.totalPoints).toBe(0);
    expect(profile.kpis.currentStreak).toBe(0);
    expect(profile.kpis.badgesEarned).toBe(0);
    expect(profile.skills).toEqual([]);
  });
});
```

Adapt fixture seeders to the existing test patterns; the intent is what matters.

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/profile.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/gamification/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { ProgressAggregatorService } from '../progress/progress.service';
import { TrackRepository } from '../content/repositories/track.repository';
import { StreakService } from './streak.service';
import { MasteryService } from './mastery.service';
import { BadgeService, BadgeStatus } from './badge.service';
import { startOfHeatStrip, buildHeatStrip } from './heat-strip.util';

export type ProfileResponse = {
  account: { studentId: string; name: string; email: string; createdAt: string; level: number };
  trackBadges: Array<{ language: 'swift' | 'kotlin'; trackTitle: string }>;
  kpis: { totalPoints: number; currentStreak: number; badgesEarned: number; badgesTotal: number };
  heatStrip: number[];
  skills: Array<{ trackId: string; title: string; language: 'swift' | 'kotlin'; progressPct: number }>;
  badges: BadgeStatus[];
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentRepository,
    private readonly users: UserRepository,
    private readonly progress: ProgressAggregatorService,
    private readonly tracks: TrackRepository,
    private readonly streak: StreakService,
    private readonly mastery: MasteryService,
    private readonly badgeService: BadgeService,
  ) {}

  async composeProfile(studentId: string): Promise<ProfileResponse> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('student not found');
    const user = await this.users.findById(student.userId);
    if (!user) throw new NotFoundException('user not found');

    // Lifetime XP via direct aggregation (matches dashboard's pattern;
    // ExerciseResultRepository has no sumByStudent helper).
    const lifetimeAgg = await this.prisma.exerciseResult.aggregate({
      where: { studentId },
      _sum: { pointsEarned: true },
    });
    const totalPoints = lifetimeAgg._sum.pointsEarned ?? 0;
    const masteryProgress = this.mastery.getProgress(totalPoints);
    const streakResult = await this.streak.getCurrentStreak(studentId);
    const badgeStatuses = await this.badgeService.listForStudent(studentId);
    const badgesEarned = badgeStatuses.filter((b) => b.earned).length;

    // Heat strip: union of Attempt + ReviewAttempt over 26 weeks.
    const now = new Date();
    const start = startOfHeatStrip(now);
    const [attempts, reviewAttempts] = await Promise.all([
      this.prisma.attempt.findMany({
        where: { studentId, submittedAt: { gte: start } },
        select: { submittedAt: true },
      }),
      this.prisma.reviewAttempt.findMany({
        where: { studentId, submittedAt: { gte: start } },
        select: { submittedAt: true },
      }),
    ]);
    const heatStrip = buildHeatStrip([...attempts, ...reviewAttempts], start, now);

    // Skills: one bar per track the student has any attempt on.
    const distinctTrackIds = await this.findTrackIdsWithActivity(studentId);
    const skills = await Promise.all(distinctTrackIds.map(async (trackId) => {
      const track = await this.tracks.findLatestPublished(trackId);
      if (!track) return null;
      const progress = await this.progress.getTrackProgress(studentId, trackId);
      const lessons = progress?.lessons ?? [];
      const completed = lessons.filter((l) => l.state === 'complete').length;
      const progressPct = lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100);
      return {
        trackId,
        title: track.title,
        language: (track.language as 'swift' | 'kotlin'),
        progressPct,
      };
    }));
    const filteredSkills = skills.filter((s): s is NonNullable<typeof s> => s !== null);
    filteredSkills.sort((a, b) => b.progressPct - a.progressPct);

    const trackBadges = filteredSkills.map((s) => ({ language: s.language, trackTitle: s.title }));

    return {
      account: {
        studentId,
        name: student.name,
        email: student.email,
        createdAt: user.createdAt.toISOString(),
        level: masteryProgress.level,
      },
      trackBadges,
      kpis: {
        totalPoints,
        currentStreak: streakResult.current,
        badgesEarned,
        badgesTotal: badgeStatuses.length,
      },
      heatStrip,
      skills: filteredSkills.slice(0, 6),
      badges: badgeStatuses,
    };
  }

  private async findTrackIdsWithActivity(studentId: string): Promise<string[]> {
    // Distinct trackIds from any exercise this student has attempted.
    // Exercise has lessonId, Lesson has trackId. Two-step lookup.
    const exerciseIds = (await this.prisma.attempt.findMany({
      where: { studentId },
      select: { exerciseId: true },
      distinct: ['exerciseId'],
    })).map((a) => a.exerciseId);
    if (exerciseIds.length === 0) return [];
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    });
    const lessonIds = exercises.map((e) => e.lessonId).filter((id): id is string => id !== null);
    if (lessonIds.length === 0) return [];
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { trackId: true },
      distinct: ['trackId'],
    });
    return lessons.map((l) => l.trackId).filter((id): id is string => id !== null);
  }
}
```

If any of `findById` / `findByUserId` / `findLatestPublished` differ in the actual repos, adjust to match. The above shape mirrors what's used by other services in this module.

- [ ] **Step 4: Wire `ProfileService` into `GamificationModule`**

In `src/gamification/gamification.module.ts`, add to providers + exports:

```ts
import { ProfileService } from './profile.service';
// ...
providers: [..., ProfileService],
exports: [..., ProfileService],
```

If `ProgressAggregatorService` / `TrackRepository` / `UserRepository` aren't already importable, ensure the appropriate modules are listed in `imports`.

- [ ] **Step 5: Run tests**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/profile.service.spec.ts
```

Expected: 2/2 PASS.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/profile.service.ts src/gamification/gamification.module.ts test/gamification/profile.service.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(profile): add ProfileService.composeProfile

Composes the per-student profile payload: account info, KPI strip,
26-week heat strip (Attempt+ReviewAttempt union, bucketed),
per-track progress bars (deriving progressPct from
getTrackProgress's lessons array), and the badge grid via
BadgeService.listForStudent. Lives inside GamificationModule —
no new module surface, just a new service that orchestrates
existing services.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 9: Add `ProfileController` route

**Files:**
- Create: `c:/tmp/bootcamp-platform-profile/src/gamification/profile.controller.ts`
- Test: `c:/tmp/bootcamp-platform-profile/test/gamification/profile.controller.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

```ts
// test/gamification/profile.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('GET /api/profile/me', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = m.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(prisma); });

  async function getAuthCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `u-${newId()}@test.com`, name: 'U', password: 'password123' });
    const raw = res.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.find((c) => c.startsWith('bc.access='))!;
  }

  it('returns the full ProfileResponse for the authenticated student', async () => {
    const cookie = await getAuthCookie();
    const res = await request(app.getHttpServer())
      .get('/api/profile/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.account).toBeDefined();
    expect(res.body.account.name).toBe('U');
    expect(res.body.heatStrip).toHaveLength(182);
    expect(res.body.kpis).toBeDefined();
    expect(Array.isArray(res.body.skills)).toBe(true);
    expect(Array.isArray(res.body.badges)).toBe(true);
    expect(Array.isArray(res.body.trackBadges)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/profile/me').expect(401);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/profile.controller.spec.ts
```

Expected: FAIL — route 404.

- [ ] **Step 3: Implement**

```ts
// src/gamification/profile.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EnsureStudentService } from '../submission/ensure-student';
import { ProfileService, ProfileResponse } from './profile.service';

@Controller('api/profile')
export class ProfileController {
  constructor(
    private readonly ensureStudent: EnsureStudentService,
    private readonly profile: ProfileService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: { userId: string }): Promise<ProfileResponse> {
    const student = await this.ensureStudent.ensureStudent(user.userId);
    return this.profile.composeProfile(student.id);
  }
}
```

In `gamification.module.ts`, add `ProfileController` to `controllers` array. If `EnsureStudentService` isn't already importable, add the appropriate module to `imports`.

- [ ] **Step 4: Run tests**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npx jest test/gamification/profile.controller.spec.ts
```

Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-platform-profile add src/gamification/profile.controller.ts src/gamification/gamification.module.ts test/gamification/profile.controller.spec.ts
git -C c:/tmp/bootcamp-platform-profile commit -m "$(cat <<'EOF'
feat(profile): add GET /api/profile/me endpoint

Thin controller delegating to ProfileService.composeProfile after
ensuring the authenticated student row exists. Returns the full
ProfileResponse: account, KPIs, heat strip, skills (per-track),
badges, trackBadges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Run the full platform sweep

**Files:** none

- [ ] **Step 1: Run all unit + integration tests**

```powershell
cd c:/tmp/bootcamp-platform-profile; DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public" JWT_SECRET="dev-secret-change-me-in-production" JWT_REFRESH_SECRET="dev-refresh-secret-change-me-in-production" WEB_ORIGIN="http://localhost:3001" npm run test
```

Expected: green across the board. Test count up by ~25 (the new tests in Tasks 2-9).

- [ ] **Step 2: Tsc clean check**

```powershell
cd c:/tmp/bootcamp-platform-profile; npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run lint and verify only pre-existing errors remain**

```powershell
cd c:/tmp/bootcamp-platform-profile; npm run lint 2>&1 | tail -30
```

Expected: same 13 pre-existing errors as platform master had before E (none in files this branch touched). Fix any NEW lint errors introduced by Tasks 2-9 inline.

### Task 11: Stash artifact files, merge platform → master

**Files:** none (git operation only)

- [ ] **Step 1: Stash any cross-cutting eslint --fix artifacts (if `npm run lint` ran)**

```powershell
git -C c:/tmp/bootcamp-platform-profile status --short
```

If files outside Tasks 2-9 are modified (eslint --fix sweep), stash them:

```powershell
git -C c:/tmp/bootcamp-platform-profile stash push -u -m "task-10-eslint-fix-cross-cutting"
```

Also stash any lockfile changes from `npm install`:

```powershell
git -C c:/tmp/bootcamp-platform-profile stash push -m "task-1-npm-install-lockfile" -- package-lock.json
```

After both stashes, working tree should be clean.

- [ ] **Step 2: Merge into platform master**

```powershell
git -C c:/Users/ricma/BootCamp/platform checkout master
git -C c:/Users/ricma/BootCamp/platform merge --ff-only feat/profile-payload
```

Expected: fast-forward succeeds.

- [ ] **Step 3: Capture the new platform master SHA**

```powershell
git -C c:/Users/ricma/BootCamp/platform rev-parse master
```

Record this SHA — needed for Task 12+ (web phase).

- [ ] **Step 4: Restore the user's previous branch**

```powershell
git -C c:/Users/ricma/BootCamp/platform checkout feat/adaptive-next-lesson
```

(Or whatever branch the user was on before — confirm with `git reflog show HEAD` if unsure.)

- [ ] **Step 5: Remove the worktree**

```powershell
git -C c:/Users/ricma/BootCamp/platform worktree remove c:/tmp/bootcamp-platform-profile --force
```

If the directory removal fails with "Permission denied" (file lock from a watcher), the registry still gets cleaned — verify with `git -C c:/Users/ricma/BootCamp/platform worktree list`. The directory can be `rm -rf`d later.

---

## Phase 2 — Web changes (`feat/profile`)

All Phase 2 work happens in `c:/tmp/bootcamp-web-profile`.

### Task 12: Create web worktree on `feat/profile`

**Files:** none (git operation only)

- [ ] **Step 1: Create worktree**

```powershell
git -C c:/Users/ricma/BootCamp/web worktree add -b feat/profile c:/tmp/bootcamp-web-profile master
```

Expected: new worktree at `c:/tmp/bootcamp-web-profile` on branch `feat/profile`, based at web master `b3c510e`.

- [ ] **Step 2: Install dependencies**

```powershell
cd c:/tmp/bootcamp-web-profile; npm install
```

Expected: install completes.

- [ ] **Step 3: Verify baseline state**

```powershell
cd c:/tmp/bootcamp-web-profile; npx tsc --noEmit 2>&1 | grep -c "error TS"
cd c:/tmp/bootcamp-web-profile; npx vitest run 2>&1 | tail -5
```

Expected: 0 tsc errors, 332 vitest tests passing.

### Task 13: Port CSS slice (.profile-head, .heat*, .medal*, .lb-*)

**Files:**
- Modify: `c:/tmp/bootcamp-web-profile/styles/app.css` (append)

- [ ] **Step 1: Append the F slice**

```css
/* ===== Profile (Sub-project F) ===== */
.profile-head {
  border-radius: var(--r-xl);
  padding: 36px;
  background:
    linear-gradient(135deg, rgba(10,166,196,0.16), rgba(214,56,143,0.12)),
    var(--bg-2);
  border: 1px solid var(--line-2);
  position: relative;
  overflow: hidden;
  margin-bottom: 32px;
}

.heat {
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  gap: 4px;
  margin-top: 12px;
}
.heat-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  background: var(--bg-3);
}
.heat-1 { background: color-mix(in oklch, var(--peacock-400) 25%, var(--bg-3)); }
.heat-2 { background: color-mix(in oklch, var(--peacock-400) 50%, var(--bg-3)); }
.heat-3 { background: color-mix(in oklch, var(--peacock-400) 75%, var(--bg-3)); }
.heat-4 { background: var(--peacock-400); }

.medal {
  width: 80px; height: 80px;
  border-radius: 50%;
  display: grid; place-items: center;
  font-size: 32px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 50%),
    var(--grad-peacock);
  color: #fff;
  flex: none;
  box-shadow: var(--sh-2);
  position: relative;
}
.medal.locked {
  background: var(--bg-2);
  border: 1px dashed var(--line-2);
  color: var(--text-4);
  box-shadow: none;
}
.medal-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 16px;
  align-items: center;
}

/* ===== Leaderboard (Sub-project F) ===== */
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
```

- [ ] **Step 2: Confirm globals.css imports `styles/app.css`**

```powershell
grep -n "app.css" c:/tmp/bootcamp-web-profile/app/globals.css
```

Expected: `@import '../styles/app.css';` already present (added in earlier sub-projects). No change needed.

- [ ] **Step 3: Commit**

```powershell
git -C c:/tmp/bootcamp-web-profile add styles/app.css
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(styles): port profile + leaderboard CSS slice from design bundle

Adds .profile-head, .heat*, .medal*, .lb-row, .lb-rank styles
from docs/superpowers/design/app.css lines 181-258.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: Add `lib/profile.ts` client + zod schema

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/lib/profile.ts`
- Create: `c:/tmp/bootcamp-web-profile/lib/profile.zod.ts`
- Test: `c:/tmp/bootcamp-web-profile/tests/lib/profile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/profile.test.ts
import { describe, it, expect } from 'vitest';
import { profileSchema } from '@/lib/profile.zod';

describe('profileSchema', () => {
  it('accepts a fully-formed payload', () => {
    const payload = {
      account: { studentId: 's-1', name: 'Test', email: 't@x.com', createdAt: new Date().toISOString(), level: 3 },
      trackBadges: [{ language: 'swift', trackTitle: 'Swift Fundamentals' }],
      kpis: { totalPoints: 1240, currentStreak: 5, badgesEarned: 3, badgesTotal: 18 },
      heatStrip: Array.from({ length: 182 }, () => 0),
      skills: [{ trackId: 't-1', title: 'Swift Fundamentals', language: 'swift', progressPct: 80 }],
      badges: [],
    };
    expect(() => profileSchema.parse(payload)).not.toThrow();
  });

  it('rejects heatStrip of wrong length', () => {
    const payload = { /* same as above but */ heatStrip: [1, 2, 3] };
    expect(() => profileSchema.parse({ ...payload })).toThrow();
  });

  it('rejects invalid attemptStatus values inside heatStrip cells', () => {
    const heatStrip = Array.from({ length: 182 }, () => 5 as any);  // > max bucket 4
    const payload = { /* fully formed */ heatStrip };
    expect(() => profileSchema.parse(payload)).toThrow();
  });
});
```

Adapt to use a complete fixture object — copy/paste the first test's payload as a base for the others.

- [ ] **Step 2: Run test to verify failure**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/profile.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/profile.zod.ts
import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']);

export const heatCell = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const profileSchema = z.object({
  account: z.object({
    studentId: z.string().min(1),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
    level: z.number().int().min(1),
  }),
  trackBadges: z.array(z.object({ language, trackTitle: z.string() })),
  kpis: z.object({
    totalPoints: z.number().int().min(0),
    currentStreak: z.number().int().min(0),
    badgesEarned: z.number().int().min(0),
    badgesTotal: z.number().int().min(0),
  }),
  heatStrip: z.array(heatCell).length(182),
  skills: z.array(z.object({
    trackId: z.string().min(1),
    title: z.string(),
    language,
    progressPct: z.number().int().min(0).max(100),
  })),
  badges: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    earned: z.boolean(),
    earnedAt: z.string().optional().nullable(),
  })),
});

export type ProfileResponse = z.infer<typeof profileSchema>;
```

```ts
// lib/profile.ts
import { profileSchema, type ProfileResponse } from './profile.zod';
import { BASE } from './api';

export type { ProfileResponse };

export async function fetchProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/api/profile/me`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`fetchProfile failed: ${res.status}`);
  const json = await res.json();
  return profileSchema.parse(json);
}
```

- [ ] **Step 4: Run tests**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/profile.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-profile add lib/profile.ts lib/profile.zod.ts tests/lib/profile.test.ts
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(lib): add fetchProfile client + zod schema

GET /api/profile/me wrapper with strict zod parsing of the response
shape. heatStrip is constrained to length 182 with cell values 0-4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 15: Extend `lib/gamification.ts` with `fetchLeaderboard(period)`

**Files:**
- Modify: `c:/tmp/bootcamp-web-profile/lib/gamification.ts`
- Modify or Create: `c:/tmp/bootcamp-web-profile/lib/leaderboard.zod.ts`
- Test: `c:/tmp/bootcamp-web-profile/tests/lib/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/leaderboard.test.ts
import { describe, it, expect } from 'vitest';
import { leaderboardSchema } from '@/lib/leaderboard.zod';

describe('leaderboardSchema', () => {
  it('accepts a fully-formed cohort-scoped payload', () => {
    const payload = {
      period: 'weekly',
      entries: [{
        rank: 1, studentId: 's-1', name: 'Maya', initials: 'M',
        language: 'swift', totalPoints: 1240, streak: 5, isMe: false,
      }],
      myRank: 1,
      myLeague: { name: 'Sapphire', xpToNext: 800, nextLeague: 'Peacock' },
      scope: 'cohort',
      cohortName: 'Spring2026',
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });

  it('accepts global scope with null cohortName', () => {
    const payload = {
      period: 'all-time', entries: [], myRank: null,
      myLeague: { name: 'Bronze', xpToNext: 300, nextLeague: 'Silver' },
      scope: 'global', cohortName: null,
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });

  it('rejects unknown period values', () => {
    const payload = { period: 'lifetime', entries: [], myRank: null, myLeague: null, scope: 'global', cohortName: null };
    expect(() => leaderboardSchema.parse(payload)).toThrow();
  });

  it('accepts top-tier myLeague with nextLeague: null and xpToNext: 0', () => {
    const payload = {
      period: 'weekly', entries: [], myRank: null,
      myLeague: { name: 'Peacock', xpToNext: 0, nextLeague: null },
      scope: 'global', cohortName: null,
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/leaderboard.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema**

```ts
// lib/leaderboard.zod.ts
import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']).nullable();

const period = z.enum(['weekly', 'monthly', 'all-time']);
const leagueName = z.enum(['Bronze', 'Silver', 'Gold', 'Sapphire', 'Peacock']);

export const leaderboardSchema = z.object({
  period,
  entries: z.array(z.object({
    rank: z.number().int().min(1),
    studentId: z.string().min(1),
    name: z.string(),
    initials: z.string(),
    language,
    totalPoints: z.number().int().min(0),
    streak: z.number().int().min(0),
    isMe: z.boolean(),
  })),
  myRank: z.number().int().nullable(),
  myLeague: z.object({
    name: leagueName,
    xpToNext: z.number().int().min(0),
    nextLeague: leagueName.nullable(),
  }).nullable(),
  scope: z.enum(['cohort', 'global']),
  cohortName: z.string().nullable(),
});

export type LeaderboardPeriod = z.infer<typeof period>;
export type LeaderboardResponse = z.infer<typeof leaderboardSchema>;
export type LeaderboardEntry = LeaderboardResponse['entries'][number];
```

- [ ] **Step 4: Add `fetchLeaderboard` to `lib/gamification.ts`**

Append:

```ts
import { leaderboardSchema, type LeaderboardPeriod, type LeaderboardResponse } from './leaderboard.zod';
export type { LeaderboardPeriod, LeaderboardResponse };

export async function fetchLeaderboard(period: LeaderboardPeriod = 'weekly'): Promise<LeaderboardResponse> {
  const res = await fetch(`${BASE}/api/leaderboard?period=${period}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`fetchLeaderboard failed: ${res.status}`);
  return leaderboardSchema.parse(await res.json());
}
```

- [ ] **Step 5: Run tests**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/leaderboard.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 6: Commit**

```powershell
git -C c:/tmp/bootcamp-web-profile add lib/gamification.ts lib/leaderboard.zod.ts tests/lib/leaderboard.test.ts
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(lib): add fetchLeaderboard(period) with zod schema

GET /api/leaderboard?period= wrapper. period is one of weekly /
monthly / all-time. Response includes myLeague (5-tier derivation)
and scope ('cohort' | 'global') for the eyebrow copy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: `HexBar`-style util — `deriveInitials` helper for web

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/lib/initials.ts`
- Test: `c:/tmp/bootcamp-web-profile/tests/lib/initials.test.ts`

The platform side computes `initials` server-side, but profile pages use the same logic locally for the user's own avatar. Add a tiny pure helper.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/initials.test.ts
import { describe, it, expect } from 'vitest';
import { deriveInitials } from '@/lib/initials';

describe('deriveInitials', () => {
  it('returns first letters of first two name parts', () => {
    expect(deriveInitials('Jordan Kim')).toBe('JK');
    expect(deriveInitials('Maya Okafor Lee')).toBe('MO');
  });
  it('handles single-name input', () => {
    expect(deriveInitials('Madonna')).toBe('M');
  });
  it('uppercases', () => {
    expect(deriveInitials('jordan kim')).toBe('JK');
  });
  it('trims whitespace', () => {
    expect(deriveInitials('  Jordan  Kim  ')).toBe('JK');
  });
  it('returns ? for empty', () => {
    expect(deriveInitials('')).toBe('?');
    expect(deriveInitials('   ')).toBe('?');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/initials.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/initials.ts
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0).slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}
```

- [ ] **Step 4: Run tests, commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/lib/initials.test.ts
git -C c:/tmp/bootcamp-web-profile add lib/initials.ts tests/lib/initials.test.ts
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(lib): add deriveInitials helper

"Jordan Kim" → "JK". Used by profile and leaderboard avatars
when a server-side initials field isn't available (e.g. own avatar
in the profile head, before the leaderboard payload arrives).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: Build `HeatStrip` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/profile/HeatStrip.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/profile/HeatStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/profile/HeatStrip.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HeatStrip } from '@/components/profile/HeatStrip';

describe('HeatStrip', () => {
  it('renders 182 cells', () => {
    const cells = Array.from({ length: 182 }, () => 0);
    const { container } = render(<HeatStrip cells={cells} />);
    expect(container.querySelectorAll('.heat-cell')).toHaveLength(182);
  });

  it('applies heat-N class per cell value', () => {
    const cells = [0, 1, 2, 3, 4, ...Array.from({ length: 177 }, () => 0)];
    const { container } = render(<HeatStrip cells={cells as number[]} />);
    const all = container.querySelectorAll('.heat-cell');
    expect(all[0]).not.toHaveClass('heat-1');
    expect(all[1]).toHaveClass('heat-1');
    expect(all[2]).toHaveClass('heat-2');
    expect(all[3]).toHaveClass('heat-3');
    expect(all[4]).toHaveClass('heat-4');
  });

  it('exposes an aria-label with active-day count', () => {
    const cells = Array.from({ length: 182 }, (_, i) => (i < 30 ? 1 : 0));
    const { container } = render(<HeatStrip cells={cells} />);
    const wrapper = container.querySelector('.heat');
    expect(wrapper?.getAttribute('aria-label')).toMatch(/30 active days/);
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/HeatStrip.test.tsx
```

Expected: FAIL.

```tsx
// components/profile/HeatStrip.tsx
export function HeatStrip({ cells }: { cells: ReadonlyArray<number> }) {
  const active = cells.filter((c) => c > 0).length;
  return (
    <div
      className="heat"
      aria-label={`${active} active days in the past 26 weeks`}
      style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gridAutoColumns: '1fr', gap: 4 }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          className={`heat-cell${v > 0 ? ` heat-${v}` : ''}`}
          style={{ aspectRatio: 1 }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/HeatStrip.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/profile/HeatStrip.tsx tests/profile/HeatStrip.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(profile): add HeatStrip component

Renders a 26x7 grid of .heat-cells. Each cell carries a heat-N
class (1-4) when v > 0; v=0 renders as base .heat-cell. Aria-label
exposes total active-days count.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: Build `SkillsList` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/profile/SkillsList.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/profile/SkillsList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/profile/SkillsList.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillsList } from '@/components/profile/SkillsList';

describe('SkillsList', () => {
  it('renders one row per skill with correct % and name', () => {
    const skills = [
      { trackId: 't-1', title: 'Swift Fundamentals', language: 'swift' as const, progressPct: 80 },
      { trackId: 't-2', title: 'Kotlin Fundamentals', language: 'kotlin' as const, progressPct: 40 },
    ];
    render(<SkillsList skills={skills} />);
    expect(screen.getByText('Swift Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Kotlin Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('uses iris background for swift bars and amber for kotlin', () => {
    const skills = [
      { trackId: 't-1', title: 'Swift', language: 'swift' as const, progressPct: 50 },
      { trackId: 't-2', title: 'Kotlin', language: 'kotlin' as const, progressPct: 50 },
    ];
    const { container } = render(<SkillsList skills={skills} />);
    const fills = container.querySelectorAll('.bar-fill');
    expect(fills[0].getAttribute('style')).toContain('iris');
    expect(fills[1].getAttribute('style')).toContain('amber');
  });

  it('renders empty state when no skills', () => {
    render(<SkillsList skills={[]} />);
    expect(screen.getByText(/no tracks/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/profile/SkillsList.tsx
type Skill = {
  trackId: string;
  title: string;
  language: 'swift' | 'kotlin';
  progressPct: number;
};

export function SkillsList({ skills }: { skills: ReadonlyArray<Skill> }) {
  if (skills.length === 0) {
    return (
      <div className="card">
        <h3 className="h3" style={{ marginBottom: 16 }}>Skills mastered</h3>
        <p className="muted">No tracks practiced yet — start a lesson to see your skills here.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h3 className="h3" style={{ marginBottom: 16 }}>Skills mastered</h3>
      <div className="stack-tight">
        {skills.map((s) => (
          <div key={s.trackId}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>{s.title}</span>
              <span className="mono muted" style={{ fontSize: 'var(--t-xs)' }}>{s.progressPct}%</span>
            </div>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${s.progressPct}%`,
                  background: s.language === 'swift' ? 'var(--iris-400)' : 'var(--amber-400)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/SkillsList.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/profile/SkillsList.tsx tests/profile/SkillsList.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(profile): add SkillsList component

One progress bar per track the student has practiced. Color from
language (swift→iris, kotlin→amber). Empty state copy when zero
tracks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 19: Build `BadgesGrid` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/profile/BadgesGrid.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/profile/BadgesGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/profile/BadgesGrid.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgesGrid } from '@/components/profile/BadgesGrid';

describe('BadgesGrid', () => {
  it('shows "X / N earned" header', () => {
    const badges = [
      { id: 'a', title: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' },
      { id: 'b', title: 'B', description: 'b', icon: 'flame', earned: true, earnedAt: '2026-04-25' },
      { id: 'c', title: 'C', description: 'c', icon: 'star', earned: false, earnedAt: null },
    ];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText(/2 \/ 3 earned/i)).toBeInTheDocument();
  });

  it('renders each badge with title and description', () => {
    const badges = [
      { id: 'a', title: 'First lesson', description: 'Did one lesson', icon: 'trophy', earned: true, earnedAt: '2026-04-19' },
    ];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText('First lesson')).toBeInTheDocument();
    expect(screen.getByText('Did one lesson')).toBeInTheDocument();
  });

  it('shows "Earned <date>" for earned badges and "Locked" for unearned', () => {
    const badges = [
      { id: 'a', title: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' },
      { id: 'b', title: 'B', description: 'b', icon: 'star', earned: false, earnedAt: null },
    ];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText(/Earned/i)).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
  });

  it('applies .locked class to unearned medals', () => {
    const badges = [
      { id: 'a', title: 'A', description: 'a', icon: 'trophy', earned: false, earnedAt: null },
    ];
    const { container } = render(<BadgesGrid badges={badges} />);
    expect(container.querySelector('.medal.locked')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/profile/BadgesGrid.tsx
type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null | undefined;
};

export function BadgesGrid({ badges }: { badges: ReadonlyArray<Badge> }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 18 }}>
        <h3 className="h3">Badges</h3>
        <span className="muted mono" style={{ fontSize: 'var(--t-xs)' }}>{earned} / {badges.length} earned</span>
      </div>
      <div className="stack-tight">
        {badges.map((b) => (
          <div key={b.id} className="medal-row">
            <div className={`medal${b.earned ? '' : ' locked'}`} style={{ width: 64, height: 64, fontSize: 24 }}>
              <span aria-hidden="true">{b.icon[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
              <div className="muted" style={{ fontSize: 'var(--t-sm)' }}>{b.description}</div>
              <div
                className="mono"
                style={{
                  fontSize: 'var(--t-2xs)',
                  color: b.earned ? 'var(--peacock-300)' : 'var(--text-3)',
                  marginTop: 4,
                }}
              >
                {b.earned ? `Earned ${b.earnedAt ?? ''}`.trim() : 'Locked'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/BadgesGrid.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/profile/BadgesGrid.tsx tests/profile/BadgesGrid.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(profile): add BadgesGrid component

Renders each badge as a medal row with title/description and
"Earned <date>" or "Locked" footer. Header shows X / N earned.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 20: Build `ProfileHead` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/profile/ProfileHead.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/profile/ProfileHead.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/profile/ProfileHead.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileHead } from '@/components/profile/ProfileHead';

describe('ProfileHead', () => {
  const account = { studentId: 's-1', name: 'Jordan Kim', email: 'j@x.com', createdAt: '2026-03-01T00:00:00Z', level: 3 };
  const trackBadges = [{ language: 'swift' as const, trackTitle: 'Swift Fundamentals' }];
  const kpis = { totalPoints: 1240, currentStreak: 12, badgesEarned: 4, badgesTotal: 18 };

  it('renders name + level + member-since eyebrow', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText('Jordan Kim')).toBeInTheDocument();
    expect(screen.getByText(/Member since/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
  });

  it('renders KPI strip with formatted points and streak', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText(/1,240/i)).toBeInTheDocument();
    expect(screen.getByText(/12 d/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 18/i)).toBeInTheDocument();
  });

  it('renders track badges with correct color class', () => {
    const { container } = render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(container.querySelector('.badge-iris')).toBeInTheDocument();
  });

  it('renders avatar with initials', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText('JK')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/profile/ProfileHead.tsx
import { deriveInitials } from '@/lib/initials';

type Account = { studentId: string; name: string; email: string; createdAt: string; level: number };
type TrackBadge = { language: 'swift' | 'kotlin'; trackTitle: string };
type KPIs = { totalPoints: number; currentStreak: number; badgesEarned: number; badgesTotal: number };

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function ProfileHead({
  account,
  trackBadges,
  kpis,
}: {
  account: Account;
  trackBadges: ReadonlyArray<TrackBadge>;
  kpis: KPIs;
}) {
  return (
    <div className="profile-head">
      <div className="row" style={{ gap: 24, alignItems: 'center' }}>
        <div className="avatar avatar-lg" style={{ width: 96, height: 96, fontSize: 32 }}>
          {deriveInitials(account.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Member since {formatMonth(account.createdAt)} · Level {account.level}
          </div>
          <h1 className="h-display" style={{ fontSize: 'var(--t-4xl)', marginBottom: 8 }}>{account.name}</h1>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {trackBadges.map((b) => (
              <span
                key={b.trackTitle}
                className={`badge ${b.language === 'swift' ? 'badge-iris' : 'badge-amber'}`}
              >
                <span className="badge-dot" />{b.trackTitle}
              </span>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 32 }}>
          <div className="kpi"><div className="kpi-label">XP</div><div className="kpi-value mono peacock-text">{kpis.totalPoints.toLocaleString()}</div></div>
          <div className="kpi"><div className="kpi-label">Streak</div><div className="kpi-value mono">{kpis.currentStreak} d</div></div>
          <div className="kpi"><div className="kpi-label">Badges</div><div className="kpi-value mono">{kpis.badgesEarned} / {kpis.badgesTotal}</div></div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/ProfileHead.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/profile/ProfileHead.tsx tests/profile/ProfileHead.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(profile): add ProfileHead component

Avatar + name + member-since/level eyebrow + track badges +
3-KPI strip (XP, Streak, Badges). Avatar initials via the
deriveInitials helper from Task 16.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 21: Compose `/profile` page

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/profile/ProfilePage.tsx`
- Create: `c:/tmp/bootcamp-web-profile/app/(authed)/(shell)/profile/page.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/profile/ProfilePage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/profile/ProfilePage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from '@/components/profile/ProfilePage';
import type { ProfileResponse } from '@/lib/profile';

const fixture: ProfileResponse = {
  account: { studentId: 's-1', name: 'Jordan Kim', email: 'j@x.com', createdAt: '2026-03-01T00:00:00Z', level: 3 },
  trackBadges: [{ language: 'swift', trackTitle: 'Swift Fundamentals' }],
  kpis: { totalPoints: 1240, currentStreak: 12, badgesEarned: 4, badgesTotal: 18 },
  heatStrip: Array.from({ length: 182 }, () => 0),
  skills: [{ trackId: 't-1', title: 'Swift Fundamentals', language: 'swift', progressPct: 80 }],
  badges: [{ id: 'a', title: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' }],
};

describe('ProfilePage', () => {
  it('renders all major sections', () => {
    render(<ProfilePage data={fixture} />);
    expect(screen.getByText('Jordan Kim')).toBeInTheDocument();              // ProfileHead
    expect(document.querySelector('.heat')).toBeInTheDocument();             // HeatStrip
    expect(screen.getByText('Swift Fundamentals')).toBeInTheDocument();      // SkillsList
    expect(screen.getByText(/1 \/ 1 earned/i)).toBeInTheDocument();          // BadgesGrid
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/profile/ProfilePage.tsx
import type { ProfileResponse } from '@/lib/profile';
import { ProfileHead } from './ProfileHead';
import { HeatStrip } from './HeatStrip';
import { SkillsList } from './SkillsList';
import { BadgesGrid } from './BadgesGrid';

export function ProfilePage({ data }: { data: ProfileResponse }) {
  return (
    <div className="main">
      <ProfileHead account={data.account} trackBadges={data.trackBadges} kpis={data.kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div className="stack">
          <div className="card card-elevated">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="h3">Practice activity</h3>
                <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                  {data.heatStrip.filter((c) => c > 0).length} active days over the past 26 weeks
                </p>
              </div>
            </div>
            <HeatStrip cells={data.heatStrip} />
          </div>
          <SkillsList skills={data.skills} />
        </div>
        <BadgesGrid badges={data.badges} />
      </div>
    </div>
  );
}
```

```tsx
// app/(authed)/(shell)/profile/page.tsx
import { fetchProfile } from '@/lib/profile';
import { ProfilePage } from '@/components/profile/ProfilePage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await fetchProfile();
  return <ProfilePage data={data} />;
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/profile/ProfilePage.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/profile/ProfilePage.tsx app/ tests/profile/ProfilePage.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(profile): compose ProfilePage and /profile route

ProfilePage is the layout shell; the page.tsx is the thin
server component that fetches and renders. 1.6fr/1fr grid:
left column heat-strip card + skills list, right column badges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: Build `LeagueBadge` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/leaderboard/LeagueBadge.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/leaderboard/LeagueBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/leaderboard/LeagueBadge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeagueBadge } from '@/components/leaderboard/LeagueBadge';

describe('LeagueBadge', () => {
  it('shows "Currently in <name>" with xpToNext when nextLeague exists', () => {
    render(<LeagueBadge league={{ name: 'Sapphire', xpToNext: 800, nextLeague: 'Peacock' }} />);
    expect(screen.getByText(/Currently in Sapphire/i)).toBeInTheDocument();
    expect(screen.getByText(/800 XP to Peacock/i)).toBeInTheDocument();
  });

  it('omits "X XP to next" copy at top tier', () => {
    render(<LeagueBadge league={{ name: 'Peacock', xpToNext: 0, nextLeague: null }} />);
    expect(screen.getByText(/Currently in Peacock/i)).toBeInTheDocument();
    expect(screen.queryByText(/XP to/i)).not.toBeInTheDocument();
  });

  it('renders nothing when league is null', () => {
    const { container } = render(<LeagueBadge league={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/leaderboard/LeagueBadge.tsx
import type { LeaderboardResponse } from '@/lib/gamification';

export function LeagueBadge({ league }: { league: LeaderboardResponse['myLeague'] | null }) {
  if (!league) return null;
  return (
    <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
      Currently in <span style={{ color: 'var(--peacock-200)' }}>{league.name}</span>
      {league.nextLeague ? <> · {league.xpToNext.toLocaleString()} XP to {league.nextLeague}</> : null}
    </p>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/leaderboard/LeagueBadge.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/leaderboard/LeagueBadge.tsx tests/leaderboard/LeagueBadge.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(leaderboard): add LeagueBadge subtitle component

"Currently in Sapphire · 800 XP to Peacock". Top tier renders
just the league name without the XP-to-next clause. Null league
input renders nothing (cohort-less users without enough data).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: Build `LeaderboardPodium` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/leaderboard/LeaderboardPodium.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/leaderboard/LeaderboardPodium.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/leaderboard/LeaderboardPodium.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import type { LeaderboardEntry } from '@/lib/gamification';

const e = (rank: number, name: string, xp: number, lang: 'swift' | 'kotlin' = 'swift'): LeaderboardEntry => ({
  rank, studentId: `s-${rank}`, name, initials: name[0],
  language: lang, totalPoints: xp, streak: 5, isMe: false,
});

describe('LeaderboardPodium', () => {
  it('renders rank 1 in the center, rank 2 left, rank 3 right', () => {
    const entries: LeaderboardEntry[] = [
      e(1, 'Maya Okafor', 4280),
      e(2, 'Tarun Patel', 3940, 'kotlin'),
      e(3, 'Saga Lindqvist', 3210),
    ];
    render(<LeaderboardPodium entries={entries} />);
    expect(screen.getByText('Maya Okafor')).toBeInTheDocument();
    expect(screen.getByText('Tarun Patel')).toBeInTheDocument();
    expect(screen.getByText('Saga Lindqvist')).toBeInTheDocument();
    expect(screen.getByText(/4,280 XP/i)).toBeInTheDocument();
  });

  it('handles a single-entry podium gracefully', () => {
    const entries: LeaderboardEntry[] = [e(1, 'Solo', 1000)];
    render(<LeaderboardPodium entries={entries} />);
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('does not crash on empty input', () => {
    const { container } = render(<LeaderboardPodium entries={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/leaderboard/LeaderboardPodium.tsx
import type { LeaderboardEntry } from '@/lib/gamification';

export function LeaderboardPodium({ entries }: { entries: ReadonlyArray<LeaderboardEntry> }) {
  if (entries.length === 0) return null;
  // Place visual layout: [rank2, rank1, rank3]
  const ordered = [entries[1], entries[0], entries[2]].filter((p): p is LeaderboardEntry => Boolean(p));
  const visualPlaces = ordered.map((p) => p.rank);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 16, marginBottom: 32, alignItems: 'end' }}>
      {ordered.map((p, i) => {
        const isFirst = p.rank === 1;
        const heights = [180, 220, 160];
        const avatarSize = isFirst ? 80 : 64;
        const avatarBg = isFirst
          ? 'var(--grad-peacock)'
          : p.language === 'swift'
            ? 'var(--iris-400)'
            : 'var(--amber-400)';
        return (
          <div key={p.studentId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="avatar avatar-lg" style={{ width: avatarSize, height: avatarSize, background: avatarBg, fontSize: isFirst ? 24 : 18 }}>
              {p.initials}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 'var(--t-sm)', color: 'var(--peacock-200)', fontWeight: 700 }}>
                {p.totalPoints.toLocaleString()} XP
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: heights[i] ?? 160,
                background: isFirst
                  ? 'linear-gradient(180deg, var(--amber-400), color-mix(in oklch, var(--amber-400) 40%, var(--bg-2)))'
                  : 'linear-gradient(180deg, var(--bg-3), var(--bg-2))',
                borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                border: '1px solid var(--line-2)',
                borderBottom: 0,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display, var(--font-sans))',
                fontSize: isFirst ? 64 : 48,
                fontWeight: 800,
                color: isFirst ? '#2b1700' : 'var(--text-3)',
              }}
            >
              {p.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/leaderboard/LeaderboardPodium.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/leaderboard/LeaderboardPodium.tsx tests/leaderboard/LeaderboardPodium.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(leaderboard): add LeaderboardPodium component

Top-3 layout: rank 2 left, rank 1 center (taller, gold-gradient),
rank 3 right. Avatar tinted by track language; rank 1 uses the
peacock gradient. Handles partial podiums (1 or 2 entries) and
renders nothing on empty input.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 24: Build `LeaderboardList` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/leaderboard/LeaderboardList.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/leaderboard/LeaderboardList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/leaderboard/LeaderboardList.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList';
import type { LeaderboardEntry } from '@/lib/gamification';

const e = (rank: number, name: string, isMe = false): LeaderboardEntry => ({
  rank, studentId: `s-${rank}`, name, initials: name[0],
  language: 'swift', totalPoints: 1000 - rank * 10, streak: 5, isMe,
});

describe('LeaderboardList', () => {
  it('renders one .lb-row per entry with rank, name, XP', () => {
    const entries = [e(4, 'D'), e(5, 'E'), e(6, 'F')];
    const { container } = render(<LeaderboardList entries={entries} />);
    expect(container.querySelectorAll('.lb-row')).toHaveLength(3);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('applies .you class to the row matching isMe=true', () => {
    const entries = [e(4, 'D'), e(5, 'E', true), e(6, 'F')];
    const { container } = render(<LeaderboardList entries={entries} />);
    const youRow = container.querySelector('.lb-row.you');
    expect(youRow).toBeInTheDocument();
    expect(youRow?.textContent).toContain('E');
  });

  it('renders nothing for empty input', () => {
    const { container } = render(<LeaderboardList entries={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/leaderboard/LeaderboardList.tsx
import type { LeaderboardEntry } from '@/lib/gamification';

export function LeaderboardList({ entries }: { entries: ReadonlyArray<LeaderboardEntry> }) {
  if (entries.length === 0) return null;
  return (
    <div className="card card-elevated">
      <div className="stack-tight">
        {entries.map((r) => (
          <div key={r.studentId} className={`lb-row${r.isMe ? ' you' : ''}`}>
            <div className="lb-rank">{r.rank}</div>
            <div className="row" style={{ gap: 12 }}>
              <div
                className="avatar avatar-sm"
                style={{
                  background: r.language === 'kotlin'
                    ? 'var(--amber-400)'
                    : r.language === 'swift'
                      ? 'var(--iris-400)'
                      : 'var(--bg-3)',
                }}
              >
                {r.initials}
              </div>
              <div>
                <div style={{ fontSize: 'var(--t-sm)', fontWeight: r.isMe ? 600 : 500 }}>{r.name}</div>
                <div className="mono muted" style={{ fontSize: 'var(--t-2xs)', marginTop: 2 }}>
                  {r.streak}d streak
                </div>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>
              {r.totalPoints.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/leaderboard/LeaderboardList.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/leaderboard/LeaderboardList.tsx tests/leaderboard/LeaderboardList.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(leaderboard): add LeaderboardList component

Renders ranks 4-N as .lb-row elements. Avatar tinted by language
(iris/amber/bg-3 for unknown). The student's own row gets .you
plus a heavier name weight.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 25: Build `LeaderboardPageHead` component

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/leaderboard/LeaderboardPageHead.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/leaderboard/LeaderboardPageHead.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/leaderboard/LeaderboardPageHead.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardPageHead } from '@/components/leaderboard/LeaderboardPageHead';

describe('LeaderboardPageHead', () => {
  it('shows cohort name in eyebrow when scope is cohort', () => {
    render(
      <LeaderboardPageHead
        period="weekly"
        onPeriodChange={() => {}}
        myLeague={null}
        scope="cohort"
        cohortName="Spring2026"
      />,
    );
    expect(screen.getByText(/Spring2026/i)).toBeInTheDocument();
  });

  it('shows "Showing all students" eyebrow when scope is global', () => {
    render(
      <LeaderboardPageHead
        period="weekly"
        onPeriodChange={() => {}}
        myLeague={null}
        scope="global"
        cohortName={null}
      />,
    );
    expect(screen.getByText(/Showing all students/i)).toBeInTheDocument();
  });

  it('marks the active period segment', () => {
    const { container } = render(
      <LeaderboardPageHead
        period="monthly"
        onPeriodChange={() => {}}
        myLeague={null}
        scope="global"
        cohortName={null}
      />,
    );
    const monthlyBtn = screen.getByRole('button', { name: /Monthly/i });
    expect(monthlyBtn).toHaveClass('active');
  });

  it('calls onPeriodChange when a different period is clicked', async () => {
    const onChange = vi.fn();
    render(
      <LeaderboardPageHead
        period="weekly"
        onPeriodChange={onChange}
        myLeague={null}
        scope="global"
        cohortName={null}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /All-time/i }));
    expect(onChange).toHaveBeenCalledWith('all-time');
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/leaderboard/LeaderboardPageHead.tsx
import type { LeaderboardPeriod, LeaderboardResponse } from '@/lib/gamification';
import { LeagueBadge } from './LeagueBadge';

export function LeaderboardPageHead({
  period,
  onPeriodChange,
  myLeague,
  scope,
  cohortName,
}: {
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  myLeague: LeaderboardResponse['myLeague'] | null;
  scope: 'cohort' | 'global';
  cohortName: string | null;
}) {
  const heading = period === 'weekly' ? 'This week.' : period === 'monthly' ? 'This month.' : 'All-time.';
  const eyebrow = scope === 'cohort'
    ? `${cohortName ?? 'Cohort'} leaderboard`
    : 'Showing all students';

  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>
        <h1 className="h-display">{heading}</h1>
        <LeagueBadge league={myLeague} />
      </div>
      <div className="seg" role="tablist">
        {(['weekly', 'monthly', 'all-time'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`seg-btn${p === period ? ' active' : ''}`}
            onClick={() => onPeriodChange(p)}
          >
            {p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'All-time'}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/leaderboard/LeaderboardPageHead.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/leaderboard/LeaderboardPageHead.tsx tests/leaderboard/LeaderboardPageHead.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(leaderboard): add LeaderboardPageHead component

Eyebrow (cohort name OR "Showing all students"), h-display heading
that adapts to the period, league subtitle via <LeagueBadge>, and
the period segment control. The seg-btn carries .active on the
matching period; clicking a different one calls onPeriodChange.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 26: Compose `/leaderboard` page

**Files:**
- Create: `c:/tmp/bootcamp-web-profile/components/leaderboard/LeaderboardPage.tsx`
- Create: `c:/tmp/bootcamp-web-profile/app/(authed)/(shell)/leaderboard/page.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/leaderboard/LeaderboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/leaderboard/LeaderboardPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';
import type { LeaderboardResponse } from '@/lib/gamification';

const replace = vi.fn();
const useSearchParams = vi.fn(() => new URLSearchParams(''));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock('@/lib/gamification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gamification')>('@/lib/gamification');
  return { ...actual, fetchLeaderboard: vi.fn(async (period: string) => ({ ...sampleData, period })) };
});
import { fetchLeaderboard } from '@/lib/gamification';

const sampleData: LeaderboardResponse = {
  period: 'weekly',
  entries: [
    { rank: 1, studentId: 's-1', name: 'A', initials: 'A', language: 'swift', totalPoints: 100, streak: 1, isMe: false },
    { rank: 2, studentId: 's-2', name: 'B', initials: 'B', language: 'kotlin', totalPoints: 80, streak: 1, isMe: true },
    { rank: 3, studentId: 's-3', name: 'C', initials: 'C', language: 'swift', totalPoints: 60, streak: 1, isMe: false },
    { rank: 4, studentId: 's-4', name: 'D', initials: 'D', language: 'swift', totalPoints: 40, streak: 1, isMe: false },
  ],
  myRank: 2,
  myLeague: { name: 'Bronze', xpToNext: 200, nextLeague: 'Silver' },
  scope: 'cohort',
  cohortName: 'Spring2026',
};

beforeEach(() => {
  replace.mockReset();
  useSearchParams.mockReturnValue(new URLSearchParams(''));
  vi.mocked(fetchLeaderboard).mockClear();
});

describe('LeaderboardPage', () => {
  it('renders podium for top 3 and list for the rest', () => {
    render(<LeaderboardPage initialData={sampleData} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(document.querySelectorAll('.lb-row')).toHaveLength(1);  // only rank 4
  });

  it('reads period from ?period=', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('period=monthly'));
    const monthlyData: LeaderboardResponse = { ...sampleData, period: 'monthly' };
    render(<LeaderboardPage initialData={monthlyData} />);
    const monthlyBtn = screen.getByRole('button', { name: /Monthly/i });
    expect(monthlyBtn).toHaveClass('active');
  });

  it('routes to ?period= when a tab is clicked', async () => {
    render(<LeaderboardPage initialData={sampleData} />);
    await userEvent.click(screen.getByRole('button', { name: /All-time/i }));
    expect(replace).toHaveBeenCalledWith('?period=all-time', expect.objectContaining({ scroll: false }));
  });

  it('refetches when ?period= changes', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('period=monthly'));
    render(<LeaderboardPage initialData={sampleData} />);
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledWith('monthly'));
  });
});
```

- [ ] **Step 2: Run, fail, implement**

```tsx
// components/leaderboard/LeaderboardPage.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  fetchLeaderboard,
  type LeaderboardPeriod,
  type LeaderboardResponse,
} from '@/lib/gamification';
import { LeaderboardPageHead } from './LeaderboardPageHead';
import { LeaderboardPodium } from './LeaderboardPodium';
import { LeaderboardList } from './LeaderboardList';

const VALID_PERIODS: ReadonlyArray<LeaderboardPeriod> = ['weekly', 'monthly', 'all-time'];

function parsePeriodParam(input: string | null | undefined): LeaderboardPeriod {
  return VALID_PERIODS.includes(input as LeaderboardPeriod) ? (input as LeaderboardPeriod) : 'weekly';
}

export function LeaderboardPage({ initialData }: { initialData: LeaderboardResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const period = parsePeriodParam(params.get('period'));
  const [data, setData] = useState<LeaderboardResponse>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data.period === period) return;
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(period)
      .then((next) => { if (!cancelled) setData(next); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, data.period]);

  const top3 = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);

  return (
    <div className="main main-narrow">
      <LeaderboardPageHead
        period={period}
        onPeriodChange={(p) => router.replace(`?period=${p}`, { scroll: false })}
        myLeague={data.myLeague}
        scope={data.scope}
        cohortName={data.cohortName}
      />
      {loading ? <p className="muted">Loading…</p> : (
        <>
          <LeaderboardPodium entries={top3} />
          <LeaderboardList entries={rest} />
        </>
      )}
    </div>
  );
}
```

```tsx
// app/(authed)/(shell)/leaderboard/page.tsx
import { fetchLeaderboard } from '@/lib/gamification';
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { period?: string } }) {
  const valid = ['weekly', 'monthly', 'all-time'] as const;
  const period = (valid.includes(searchParams.period as (typeof valid)[number])
    ? (searchParams.period as (typeof valid)[number])
    : 'weekly');
  const initialData = await fetchLeaderboard(period);
  return <LeaderboardPage initialData={initialData} />;
}
```

- [ ] **Step 3: Run pass + commit**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/leaderboard/LeaderboardPage.test.tsx
git -C c:/tmp/bootcamp-web-profile add components/leaderboard/LeaderboardPage.tsx app/ tests/leaderboard/LeaderboardPage.test.tsx
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(leaderboard): compose LeaderboardPage and /leaderboard route

LeaderboardPage owns the period state via ?period=, refetches
leaderboard data on period change, renders podium (top 3) +
list (rest). Server-side initial fetch matches the URL period;
client-side useEffect refetches on subsequent tab clicks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 27: Repoint sidebar Profile and Leaderboard entries

**Files:**
- Modify: `c:/tmp/bootcamp-web-profile/components/shell/Sidebar.tsx`
- Test: `c:/tmp/bootcamp-web-profile/tests/shell/Sidebar.test.tsx` (extend)

The Sidebar already has Profile + Leaderboard nav items, but their hrefs point at wrong locations from the pre-F era:
- `Profile` currently → `/badges` (Sidebar.tsx:22)
- `Leaderboard` currently → `/dashboard#leaderboard` (Sidebar.tsx:23)

This task fixes both hrefs to point at the new `/profile` and `/leaderboard` routes. Icons (`user`, `trophy`) and labels stay.

- [ ] **Step 1: Read the existing Sidebar to confirm line locations**

```powershell
grep -n "Profile\|Leaderboard" c:/tmp/bootcamp-web-profile/components/shell/Sidebar.tsx
```

Expected: 2 lines for the two nav entries.

- [ ] **Step 2: Repoint the hrefs**

In `Sidebar.tsx`:

```tsx
// Before:
<SidebarNavItem icon="user" label="Profile" href="/badges" active={pathname === '/badges'} />
<SidebarNavItem icon="trophy" label="Leaderboard" href="/dashboard#leaderboard" active={false} />

// After:
<SidebarNavItem icon="user" label="Profile" href="/profile" active={pathname === '/profile'} />
<SidebarNavItem icon="trophy" label="Leaderboard" href="/leaderboard" active={pathname === '/leaderboard'} />
```

- [ ] **Step 3: Update Sidebar test**

If `tests/shell/Sidebar.test.tsx` exists and asserts on Profile/Leaderboard hrefs, update those assertions to the new paths. If it doesn't enumerate hrefs, no test change needed.

- [ ] **Step 4: Run tests + tsc**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run tests/shell/
cd c:/tmp/bootcamp-web-profile; npx tsc --noEmit
```

Expected: all green, 0 tsc errors.

- [ ] **Step 5: Commit**

```powershell
git -C c:/tmp/bootcamp-web-profile add components/shell/Sidebar.tsx tests/shell/
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
feat(shell): add Profile and Leaderboard sidebar entries

Wires the new (authed)/(shell)/profile and (authed)/(shell)/leaderboard
routes into the global Sidebar nav.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 28: Final web sweep + manual smoke

**Files:** none

- [ ] **Step 1: Run full vitest suite**

```powershell
cd c:/tmp/bootcamp-web-profile; npx vitest run
```

Expected: green. Test count up by ~30 (new tests in Tasks 14-27).

- [ ] **Step 2: Run tsc clean check**

```powershell
cd c:/tmp/bootcamp-web-profile; npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run lint**

```powershell
cd c:/tmp/bootcamp-web-profile; npm run lint 2>&1 | tail -10
```

Expected: only pre-existing errors (none in F-touched files). Fix any new errors introduced inline.

- [ ] **Step 4 (optional): Manual smoke test**

If running the dev stack is convenient:

```powershell
cd c:/Users/ricma/BootCamp; .\dev.ps1
```

Then visit:
- `http://localhost:3001/profile` — verify avatar + KPI strip + heat strip + skills + badges
- `http://localhost:3001/leaderboard?period=weekly` — verify podium + list, click "Monthly" → URL updates and ranks change
- For a cohort-less account: verify `Showing all students` eyebrow

Note any UI defects observed and fix inline.

- [ ] **Step 5: Commit any inline polish (skip if none)**

```powershell
git -C c:/tmp/bootcamp-web-profile add -p
git -C c:/tmp/bootcamp-web-profile commit -m "$(cat <<'EOF'
fix(profile-leaderboard): polish from manual smoke pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 29: Stash + merge web → master

**Files:** none (git operation only)

- [ ] **Step 1: Stash any cross-cutting eslint-fix or lockfile artifacts**

```powershell
git -C c:/tmp/bootcamp-web-profile status --short
```

If files outside Tasks 13-27 are modified, stash them (same pattern as platform Task 11).

- [ ] **Step 2: Merge into web master**

```powershell
git -C c:/Users/ricma/BootCamp/web checkout master
git -C c:/Users/ricma/BootCamp/web merge --ff-only feat/profile
```

Expected: fast-forward succeeds.

- [ ] **Step 3: Capture the new web master SHA**

```powershell
git -C c:/Users/ricma/BootCamp/web rev-parse master
```

- [ ] **Step 4: Remove the worktree**

```powershell
git -C c:/Users/ricma/BootCamp/web worktree remove c:/tmp/bootcamp-web-profile --force
```

If directory removal fails (file lock from a watcher), the registry still gets cleaned. Verify with `worktree list`.

### Task 30: Update next-session prompt for sub-project G

**Files:**
- Modify: `c:/Users/ricma/BootCamp/docs/superpowers/NEXT-SESSION-PROMPT.md`
- Modify: `c:/Users/ricma/.claude/projects/c--Users-ricma-BootCamp/memory/bootcamp_platform_project.md`

- [ ] **Step 1: Update the on-ramp content**

Edit the prompt file to:
- Mark Sub-project F (Profile + Leaderboard) as merged with the new web master SHA captured in Task 29 Step 3 and platform master SHA captured in Task 11 Step 3.
- Move the next-up subject to G (Instructor pages).
- Carry over patterns F established that G should reuse: cohort auto-scoping pattern, period-filter URL-state pattern, league-derivation pattern.
- Note the canonical view file for G (likely `app-shell.jsx` instructor variants or a separate file in the design bundle).
- Append F's entry to "Past sub-projects."

- [ ] **Step 2: Update auto-memory**

Edit `bootcamp_platform_project.md`:
- Update the line from "next: F Profile + Leaderboard" to "next: G Instructor pages".
- Append F's entry alongside D's and E's entries.

- [ ] **Step 3: Update MEMORY.md index entry**

Update the BootCamp project line in `c:/Users/ricma/.claude/projects/c--Users-ricma-BootCamp/memory/MEMORY.md` to reflect F's merge SHAs.

- [ ] **Step 4: Confirm files are saved**

The BootCamp directory is not a git repo, so no commit step is needed. Just save the markdown changes.

---

## Self-review checklist

After all tasks pass:

1. **Spec coverage:** every numbered decision in the spec maps to a task. Q1 routes (Tasks 21, 26), Q2 heat strip (Tasks 4, 5, 8, 17), Q3 cohort scope (Task 7), Q4 static refresh (Task 26), A1 two-repo (Tasks 1, 11, 12, 29), A2 period aggregation (Tasks 3, 7), A3 league (Task 2 + integrated into Task 7), A4 per-track skills (Tasks 8, 18).
2. **Placeholder scan:** no "TBD" / "TODO" / "implement appropriate X" left in the plan.
3. **Type consistency:** `ExerciseAttemptStatus` is web-only (defined in Task 12 of E, untouched here). `LeaderboardPeriod` defined in platform Task 3 + web Task 15 with identical values. `LeagueDerivation` named consistently across platform + web. `BadgeStatus` keeps existing `earnedAt: Date` shape.
4. **Worktree paths:** all platform tasks use `c:/tmp/bootcamp-platform-profile`, all web tasks use `c:/tmp/bootcamp-web-profile`. No cross-worktree confusion.
5. **Commit trailer:** every commit ends with the Co-Authored-By trailer per CLAUDE.md project convention.
