# Profile + Leaderboard — Sub-project F design

**Date:** 2026-05-04
**Sub-project:** F (Profile + Leaderboard) — sixth in the multi-PR UI refactor
**Web base:** `master @ b3c510e`
**Platform base:** `master @ bbf4f5f`
**Repo scope:** two-repo, platform-first then web
**Predecessors:** A (UI Foundation), B (App Shell), C (Dashboard, two-repo), D (Tracks / Skill Tree, web-only), E (Lesson Player, two-repo)

## Summary

Add two new authenticated routes — `/profile` and `/leaderboard` — under the `(authed)/(shell)` route group. Profile shows the student's avatar, KPI strip, 26-week activity heatmap, per-track progress bars, and badges grid. Leaderboard shows the student's cohort ranked by XP (with global fallback for cohort-less users) over a Weekly/Monthly/All-time time-frame, with a top-3 podium + ranks 4-N list and a derived "league" badge based on `mastery.level`.

Two-repo sub-project: platform ships a new `GET /api/profile/me` endpoint and extends `GET /api/leaderboard` with a `?period=` query and `myLeague` field; web consumes both.

## Goals

- Ship `/profile` and `/leaderboard` matching the design bundle's `app-profile.jsx`.
- Reuse existing platform services (`getTrackProgress`, `MasteryService`, `BadgeService`, `StreakService`, `LeaderboardService`) — no new schema, no new tables.
- Add per-period leaderboard aggregation for Weekly / Monthly / All-time.
- Derive a 5-tier league name (Bronze / Silver / Gold / Sapphire / Peacock) from `mastery.level` without persistence.
- Ship the heatmap, podium, medal grid, and `.lb-row` styling from the design bundle into `web/styles/app.css`.

## Non-goals

- Persistent league system with weekly promotion/demotion (no `studentLeague` table, no cron).
- Live rank updates (SSE, polling, focus-refresh) — leaderboard refreshes on mount and on period-tab change only.
- Per-concept skill bars — concepts (`/api/progress/concepts`) are not used; skills bars come from per-track progress.
- Cross-cohort or per-track filtering inside the leaderboard — cohort scope is auto-set from the student's cohortId; no scope picker.
- A "Settings" or "Edit profile" page — the profile is read-only in V1.
- Avatar upload — initials are derived from the name; no image storage.

## Design decisions

### Q1 — Two separate routes

`/profile` and `/leaderboard` are independent server-rendered pages under `app/(authed)/(shell)/`. Each has its own `force-dynamic` page.tsx, its own data fetch, and its own loading skeleton. The sidebar's user-pill links to `/profile`. A "View leaderboard" button or sidebar link reaches `/leaderboard`. No tabbed shell, no shared header.

### Q2 — Heat strip: 26 weeks, streak-eligible activity, 0/1/2-3/4-6/7+ buckets

The heatmap shows a fixed 26-week × 7-day grid (182 cells). A day's intensity comes from the count of `Attempt + ReviewAttempt` rows for that student on that UTC day, bucketed:

| Count | Bucket | CSS class |
|---|---|---|
| 0 | 0 | (no extra class — uses `.heat-cell` base) |
| 1 | 1 | `.heat-1` |
| 2-3 | 2 | `.heat-2` |
| 4-6 | 3 | `.heat-3` |
| 7+ | 4 | `.heat-4` |

The `Attempt + ReviewAttempt` union mirrors the existing `StreakService` "active day" definition — same source of truth as the streak number shown in the same KPI strip.

### Q3 — Leaderboard: cohort-only auto-scope, global fallback

Scope precedence on `GET /api/leaderboard`:

1. **Explicit `?cohortId=` query, with access** — instructor of that cohort or student of it. Existing behavior. Used by instructor dashboards.
2. **No explicit query, authenticated student has `cohortId`** — implicit cohort scope from `myStudent.cohortId`. **NEW behavior added by F.**
3. **No explicit query, no student `cohortId`** (instructor, admin, demo) — global top-50 fallback. Existing behavior.

The web client always calls `GET /api/leaderboard` (without `cohortId`); the backend resolves the student's cohort and either scopes to it or falls back. `LeaderboardResponse.scope` is `'cohort'` or `'global'` for the eyebrow copy. `cohortName` is the cohort's display name when `scope === 'cohort'`.

### Q4 — Static, refresh on mount

`/leaderboard` is a `force-dynamic` page. The `?period=` query drives the time-frame filter; clicking a period segment calls `router.replace('?period=' + p, { scroll: false })` and triggers a fresh fetch. No polling, no SSE, no focus-refresh.

### A1 — Two-repo, platform-first

Platform branch `feat/profile-payload` ships first off `bbf4f5f`. Web branch `feat/profile` consumes second off `b3c510e`. Mirrors the C and E sequencing pattern. Local-only merges, no remote, no PRs.

### A2 — Time-frame aggregation

`weekly` and `monthly` periods sum `Attempt.pointsAwarded` over the window:

- **Weekly:** `submittedAt >= ` most recent Monday 00:00 UTC.
- **Monthly:** `submittedAt >= ` 1st-of-current-month 00:00 UTC.
- **All-time:** existing aggregation — sum of `ExerciseResult.pointsEarned`.

`pointsAwarded` is 0 for failed attempts (per `ScoringService`), so a `passed` filter is unnecessary. Re-attempting an old exercise within the window credits weekly XP — engagement-friendly.

Edge: timezones near UTC midnight create per-student bucket-boundary surprises. Acceptable for V1; per-student-locale boundary deferred.

### A3 — 5-tier league derivation by `mastery.level`

| League | `mastery.level` | Lifetime XP threshold (per the triangular curve) |
|---|---|---|
| Bronze | 1-2 | 0 |
| Silver | 3-4 | 300 |
| Gold | 5-6 | 1,000 |
| Sapphire | 7-9 | 2,100 |
| Peacock | 10+ | 4,500 |

Pure derivation, no persistence. Returned on the leaderboard payload as:

```ts
myLeague: { name: 'Sapphire', xpToNext: 800, nextLeague: 'Peacock' } | null
```

`xpToNext` is the lifetime-XP gap to the next tier's `minLevel` threshold. Top-tier returns `nextLeague: null` and `xpToNext: 0`. Cohort-less users (global fallback scope) still get a `myLeague` since it's derived from their own level.

### A4 — Skills mastered = per-track progress

For each track the student has any attempts on, call the existing `ProgressAggregatorService.getTrackProgress(studentId, trackId)`. Project to `{ trackId, title, language, progressPct }`. Color picks: `swift` → iris, `kotlin` → amber. Ordered by `progressPct` descending so the most-complete track surfaces first. Hard cap of 6 entries (matches V1 track count).

## Architecture

### Repo layout (after F merges)

```
platform/                                (branch: master ← feat/profile-payload)
  src/
    gamification/                         (existing module — F adds two files)
      profile.controller.ts               — GET /api/profile/me  (NEW)
      profile.service.ts                  — composeProfile(studentId)  (NEW)
      heat-bucket.util.ts                 — toBucket(count) → 0..4  (NEW)
      leaderboard.controller.ts           — extended with ?period= and myLeague
      leaderboard-period.util.ts          — computeWindowStart('weekly'|'monthly'|'all-time')  (NEW)
      league.util.ts                      — deriveLeague(level, totalPoints)  (NEW)
  test/                                   — unit + integration for the above

web/                                     (branch: master ← feat/profile)
  app/(authed)/(shell)/
    profile/page.tsx                     — server: fetchProfile() → <ProfilePage>
    leaderboard/page.tsx                 — server: initial fetchLeaderboard() → <LeaderboardPage>
  components/profile/
    ProfilePage.tsx
    ProfileHead.tsx                      — avatar + name + eyebrow + track badges + KPI strip
    HeatStrip.tsx                        — 26×7 grid of .heat-cells
    SkillsList.tsx                       — per-track progress bars
    BadgesGrid.tsx                       — 6 medal-rows + "X / N earned" header
  components/leaderboard/
    LeaderboardPage.tsx                  — client; period state owns ?period=
    LeaderboardPageHead.tsx              — eyebrow + h-display + period seg + league subtitle
    LeaderboardPodium.tsx                — top-3 layout (places 2/1/3) with track-colored avatars
    LeaderboardList.tsx                  — ranks 4-N as .lb-row, .you class on student match
    LeagueBadge.tsx                      — "Currently in Sapphire — 800 XP to Peacock"
  lib/
    profile.ts                           — fetchProfile() (NEW)
    gamification.ts                      — extended fetchLeaderboard(period)
  styles/app.css                         — appended .profile-head, .heat*, .medal*, .lb-* slices
```

### URL state model

`/profile` is pure server-rendered, no URL state. `/leaderboard?period=weekly|monthly|all-time` drives the filter via `useSearchParams`. Default period is `weekly` if absent or invalid. Period segment buttons call `router.replace('?period=' + p, { scroll: false })`. Browser back/forward works automatically.

### Data shapes (web)

```ts
// lib/profile.ts
export type ProfileResponse = {
  account: { studentId: string; name: string; email: string; createdAt: string; level: number };
  trackBadges: Array<{ language: 'swift' | 'kotlin'; trackTitle: string }>;
  kpis: { totalPoints: number; currentStreak: number; badgesEarned: number; badgesTotal: number };
  heatStrip: number[];                 // length 182, each value 0-4
  skills: Array<{
    trackId: string;
    title: string;
    language: 'swift' | 'kotlin';
    progressPct: number;               // 0-100
  }>;
  badges: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    earned: boolean;
    earnedAt: string | null;
  }>;
};

// lib/gamification.ts (extended)
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all-time';

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  initials: string;                    // "Maya Okafor" → "MO"
  language: 'swift' | 'kotlin' | null; // for avatar tint
  totalPoints: number;
  streak: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myLeague: { name: string; xpToNext: number; nextLeague: string | null } | null;
  scope: 'cohort' | 'global';
  cohortName: string | null;
};
```

### Platform — `ProfileService.composeProfile(studentId)`

```ts
async composeProfile(studentId: string): Promise<ProfileResponse> {
  const student = await this.students.findById(studentId);
  if (!student) throw new NotFoundException('student not found');
  const user = await this.users.findById(student.userId);

  // KPIs + level
  const totalPoints = await this.results.sumByStudent(studentId);
  const streak = await this.streak.getCurrentStreak(studentId);
  const masteryProgress = this.mastery.getProgress(totalPoints);
  // Badges: extract the existing dashboard's BadgeStatus[] composition into a
  // shared method during P6. Likely lives inside DashboardController body
  // today (or BadgeRepository); needs to become reusable from ProfileService.
  const badgeStatuses = await this.composeBadgeStatuses(studentId);
  const badgesEarned = badgeStatuses.filter((b) => b.earned).length;

  // Heat strip
  const start = startOfHeatStrip();  // 26*7 days ago, UTC midnight
  const [attempts, reviews] = await Promise.all([
    this.prisma.attempt.findMany({ where: { studentId, submittedAt: { gte: start } }, select: { submittedAt: true } }),
    this.prisma.reviewAttempt.findMany({ where: { studentId, submittedAt: { gte: start } }, select: { submittedAt: true } }),
  ]);
  const heatStrip = buildHeatStrip(attempts.concat(reviews), start);

  // Skills (per-track)
  const tracksWithActivity = await this.tracksWithStudentActivity(studentId);
  const skills = await Promise.all(
    tracksWithActivity.map(async (t) => {
      const progress = await this.progress.getTrackProgress(studentId, t.id);
      return { trackId: t.id, title: t.title, language: t.language, progressPct: progress.percent };
    }),
  );
  skills.sort((a, b) => b.progressPct - a.progressPct);

  return {
    account: { studentId, name: student.name, email: student.email, createdAt: user!.createdAt.toISOString(), level: masteryProgress.level },
    trackBadges: tracksWithActivity.map((t) => ({ language: t.language, trackTitle: t.title })),
    kpis: { totalPoints, currentStreak: streak.current, badgesEarned, badgesTotal: badgeStatuses.length },
    heatStrip,
    skills: skills.slice(0, 6),
    badges: badgeStatuses,
  };
}
```

### Platform — leaderboard period extension

In `leaderboard.controller.ts`, the existing `getLeaderboard()` gains `@Query('period')`. The aggregation switches:

```ts
const period = parsePeriod(query.period);  // default 'weekly'
const windowStart = computeWindowStart(period);  // null for all-time

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
```

The rest of the controller (sort, top-50, myRank lookup) is unchanged. `myLeague` derivation:

```ts
const myStudent = await this.students.findByUserId(user.userId);
const myTotalPoints = myStudent ? await this.results.sumByStudent(myStudent.id) : 0;
const myLevel = this.mastery.getProgress(myTotalPoints).level;
const myLeague = myStudent ? deriveLeague(myLevel, myTotalPoints) : null;
```

### Platform — `deriveLeague` shape

```ts
const TIERS: ReadonlyArray<{ name: LeagueName; minLevel: number; minXP: number }> = [
  { name: 'Peacock',  minLevel: 10, minXP: 4500 },
  { name: 'Sapphire', minLevel: 7,  minXP: 2100 },
  { name: 'Gold',     minLevel: 5,  minXP: 1000 },
  { name: 'Silver',   minLevel: 3,  minXP:  300 },
  { name: 'Bronze',   minLevel: 1,  minXP:    0 },
];

export function deriveLeague(level: number, totalPoints: number) {
  const idx = TIERS.findIndex((t) => level >= t.minLevel);
  const current = TIERS[idx];
  const next = idx > 0 ? TIERS[idx - 1] : null;
  return {
    name: current.name,
    xpToNext: next ? Math.max(0, next.minXP - totalPoints) : 0,
    nextLeague: next?.name ?? null,
  };
}
```

XP thresholds align with the triangular curve (`100·L·(L-1)/2`): `minXP[L] = 100·L·(L-1)/2`. Computed at module load, never changes.

### Web — `ProfilePage` composition

```tsx
export function ProfilePage({ data }: { data: ProfileResponse }) {
  return (
    <div className="main">
      <ProfileHead account={data.account} trackBadges={data.trackBadges} kpis={data.kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div className="stack">
          <HeatStrip cells={data.heatStrip} />
          <SkillsList skills={data.skills} />
        </div>
        <BadgesGrid badges={data.badges} />
      </div>
    </div>
  );
}
```

### Web — `LeaderboardPage` composition

```tsx
'use client';
export function LeaderboardPage({ initialData }: { initialData: LeaderboardResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const period = parsePeriod(params.get('period'));  // 'weekly' default
  const [data, setData] = useState<LeaderboardResponse>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data.period === period) return;  // initial render matches URL
    setLoading(true);
    fetchLeaderboard(period)
      .then((next) => setData(next))
      .finally(() => setLoading(false));
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
      {loading ? <LeaderboardSkeleton /> : (
        <>
          {top3.length > 0 && <LeaderboardPodium entries={top3} />}
          {rest.length > 0 && <LeaderboardList entries={rest} />}
        </>
      )}
    </div>
  );
}
```

## Build sequence

### Platform — `feat/profile-payload`

| Step | Description |
|---|---|
| P0 | Create worktree at `c:/tmp/bootcamp-platform-profile` off `bbf4f5f`. |
| P1 | `deriveLeague` helper + 5 unit tests. |
| P2 | `computeWindowStart` + `parsePeriod` helpers + tests for week/month/all-time boundaries. |
| P3 | Extend `LeaderboardController` with `?period=` query, `myLeague` field, scope/cohortName fields. Adapt aggregation; add tests. |
| P4 | `toBucket` heat-strip helper + tests for boundaries 0/1/2-3/4-6/7+. |
| P5 | `buildHeatStrip` helper (day-bucketing over 182 days) + tests. |
| P6 | Extract existing dashboard badge-composition path into a shared method (`BadgeService.listForStudent` or similar) — discover the current call site and refactor into a reusable shape ProfileService can call. Tests follow the existing dashboard tests' shape. |
| P7 | `ProfileService.composeProfile()` + integration tests. |
| P8 | `ProfileController` route registered inside `GamificationModule` + e2e test. |
| P9 | Sweep tests + tsc + lint. Merge platform → master. |

### Web — `feat/profile`

| Step | Description |
|---|---|
| W0 | Create worktree at `c:/tmp/bootcamp-web-profile` off `b3c510e`. |
| W1 | Port CSS slice (`.profile-head`, `.heat*`, `.medal*`, `.lb-*`) into `styles/app.css`. |
| W2 | `lib/profile.ts` with `fetchProfile()` + zod schema for `ProfileResponse`. |
| W3 | Extend `lib/gamification.ts` with `fetchLeaderboard(period)` + zod schema for the extended `LeaderboardResponse`. |
| W4 | Build `HeatStrip` component + tests. |
| W5 | Build `SkillsList` + tests. |
| W6 | Build `BadgesGrid` + tests. |
| W7 | Build `ProfileHead` + tests. |
| W8 | Compose `ProfilePage` + `app/(authed)/(shell)/profile/page.tsx`. E2E smoke. |
| W9 | Build `LeagueBadge` + tests. |
| W10 | Build `LeaderboardPodium` + tests. |
| W11 | Build `LeaderboardList` + tests. |
| W12 | Build `LeaderboardPageHead` + tests. |
| W13 | Compose `LeaderboardPage` + `app/(authed)/(shell)/leaderboard/page.tsx`. E2E walks (weekly → monthly → all-time tab clicks). |
| W14 | Add user-pill / sidebar entry points to `/profile` and `/leaderboard` (in `Sidebar.tsx`). |
| W15 | Final tsc + vitest + lint sweep. Merge web → master. |

Estimated 6-9 platform commits, 14-18 web commits.

## Testing strategy

### Platform unit / integration

- `deriveLeague`: 5 unit tests, one per tier, plus the top-tier edge (xpToNext = 0, nextLeague = null) and a level-1 edge (Bronze, nextLeague = Silver).
- `toBucket`: 6 unit tests covering each boundary.
- `computeWindowStart`: weekly = most recent Monday 00:00 UTC; monthly = 1st-of-month 00:00 UTC; all-time = null. Tests use a frozen `Date.now()`.
- `buildHeatStrip`: 5 unit tests — empty, sparse, contiguous activity, edge of window, overflow trim.
- `ProfileService.composeProfile()`: integration test seeds student with attempts + review attempts + badges + multi-track enrollment, asserts all 6 fields.
- `LeaderboardController`: integration test for each period (weekly/monthly/all-time), cohort scope, global fallback, `myLeague` field, `myRank`.

### Web unit (Vitest)

- `HeatStrip`: snapshot for 0-cell / sparse / dense; aria-label exposes "X active days in 26 weeks."
- `SkillsList`: 0 / 1 / 6 tracks; color class matches language.
- `BadgesGrid`: earned + locked rendering; "X / N earned" header.
- `ProfileHead`: KPIs render; track badges render with correct color class.
- `LeaderboardPodium`: full top-3, partial (2 students), single student.
- `LeaderboardList`: `.you` class on the matching student row; rank ordering preserved.
- `LeagueBadge`: top tier omits "X XP to next" copy; lower tiers include it.
- `LeaderboardPage`: `?period=` drives `router.replace`; period seg active state matches URL.

### Web E2E (Playwright)

- `/profile`: load → assert heat-strip cells, KPI numbers, all 6 medals visible, track badges present.
- `/leaderboard`: load → assert podium + ranks; click "Monthly" → URL updates and ranks change; click "All-time" → ranks change again.
- Cohort-less user (admin viewing as student) → eyebrow `Showing all students` visible.

### Verification gate

`npx tsc --noEmit` clean across both repos at end of sub-project. `npm run lint` clean for E.fixups-style residual errors. All vitest + jest green.

## Migration & rollback

- **No schema changes** — `ProfileService` reads existing tables; `LeaderboardController` extension is additive.
- `GET /api/leaderboard` default period changes from "all-time" (implicit) to "weekly". This affects any existing client calling the endpoint without a period. Mitigation: confirm during P3 that `dashboard.controller.ts → MasteryService` uses a separate code path that still aggregates all-time, OR explicitly preserve all-time semantics inside `getRank()` regardless of the controller's default.
- Web rollback = revert the web branch. Platform branch can stay merged with no client impact (additive changes).

## Risks

- **Default-period behavior shift** (above): if dashboard rank silently becomes weekly-scoped, students see their dashboard rank fluctuate week-to-week instead of accumulating. Confirm in P3 implementation; pin tests to all-time semantics for the dashboard path.
- **Heat-strip query cost** at scale: `findMany` on `Attempt` filtered by 26-week window. With per-student attempt counts in the low thousands at most, this is fine. If it ever becomes hot, materialize a per-day daily-activity table (out of scope for V1).
- **Cohort fallback logic**: students without `cohortId` see global, others see cohort. The boundary case is "student is in a tiny cohort (size 1) — leaderboard only shows themselves" — UX acceptable, defensible product behavior, no special-case needed.
- **Global fallback scope leak**: cohort-less student must NOT see entries scoped to a specific cohort, only the true global top-50. Existing endpoint already handles this; P3 just preserves it.

## Open follow-ups (out of scope for F)

- Per-locale week boundary on the leaderboard (V1 is hard UTC).
- Live rank updates (SSE or focus-refresh) — wait for engagement data first.
- Real persistent league system with promotion/demotion + cron.
- Avatar upload — initials are derived from name in V1.
- Per-concept skill bars (drilling into a track's concept mastery).
- Edit-profile / settings page.

## Predecessor patterns this design reuses

- **Two-repo / two-PR shape from C and E** — same worktree pattern, sequencing, merge-locally convention.
- **Route group split from E** — pages go under `(authed)/(shell)/` (NOT `(immersive)`).
- **URL-driven view state from E** — `?period=` mirrors E's `?step=N`.
- **Period seg control pattern from existing dashboard** — reuse the `.seg` + `.seg-btn` styling from the dashboard's segmented control.
- **Inline page-private helpers from D** — `LeaderboardPage` keeps `LeaderboardSkeleton` etc. inline rather than promoting them.

## References

- Design bundle: `docs/superpowers/design/app-profile.jsx` (defines both `Profile` and `Leaderboard`), `docs/superpowers/design/app.css` (`.profile-head`, `.heat-cell`, `.heat-1..4`, `.medal*`, `.lb-row`, `.lb-rank`).
- Predecessor specs: `2026-05-02-dashboard-design.md` (C — leaderboard endpoint shape), `2026-04-23-progress-and-mastery-design.md` (Improve-A — `getTrackProgress`).
- CLAUDE.md constraints: no UI-only changes that bypass platform validation; gamification cannot fail submission.
