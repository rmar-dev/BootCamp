# Dashboard Refactor — Daily Strip, Up Next, Paths, Mini Leaderboard

**Date:** 2026-05-02
**Sub-project:** C (of 8 — UI refactor)
**Status:** Approved (brainstorming)
**Builds on:** Sub-project A (UI Foundation) merged 2026-05-01 at web `master` `806fed0`; Sub-project B (App Shell) merged 2026-05-01 at web `master` `c4b4483`.
**Source design bundle:** `c:/tmp/design-bootcamp/bootcamp/project/` — `app-dashboard.jsx`, `app.css`.
**Spans two repos:** `web/` (Next.js) and `platform/` (NestJS).

## Context

Sub-projects A + B shipped the primitives library, theme/density mechanism, route-group chrome (Sidebar + Topbar), and a per-page heading-bar shim. The dashboard page (`web/app/(authed)/dashboard/page.tsx`) still renders the legacy composition: `StatsCard` + `BadgesGrid` + `LeaderboardTable` + `ConceptMastery` + `ReviewWidget` stacked vertically with Tailwind `bg-gray-*` styling. The new chrome wraps it but the body is unstyled.

This sub-project ports the design's `/dashboard` layout — daily strip (today's plan + streak/XP/mastery KPIs), Up next + Recently completed lesson rows, Your paths progress cards, mini leaderboard — into the live app. It introduces `TrackContext` (the long-deferred carry-over from A/B) so the chrome's stub Swift/Kotlin segmented control and active-track pill come alive. It also extends the platform's `GET /api/dashboard/me` payload with the data the new layout needs.

## Goal

Refactor `app/(authed)/dashboard/page.tsx` to match the design's composition, backed by a single extended dashboard payload from platform. Ship as two coordinated PRs (platform first, web second). Deliver the active-track switching mechanic that makes the chrome's stubs functional. Delete five obsolete components.

## Decisions

### D1. Lift `TrackContext` in C

The dashboard is fundamentally track-aware (course title, today's plan, paths). Sub-projects B's `Topbar` SegmentedControl and Sidebar `ActiveTrackPill` carry inline TODOs pointing at C/D for this lift.

**Lifting in C, not D**, avoids a double-touch (C would otherwise hardcode Swift, D would re-edit the same files). Brings the chrome stubs to life immediately. Provider shape is small.

**Provider:** `web/lib/track-context.tsx` — single file holding context, `TrackProvider`, and `useActiveTrack` hook. Initial `trackId` = `null` (no SSR/localStorage read on first render). On mount: `useEffect` reads `localStorage['bootcamp.activeTrackId']`; if absent or stale, falls back to `tracks[0].id`. `setTrackId` persists. Storage key `bootcamp.activeTrackId` matches the existing `bootcamp.theme` / `bootcamp.density` namespacing.

**Mount point:** wraps `<Sidebar>` and `<Topbar>` inside `app/(authed)/layout.tsx`, after the auth gate. Public routes stay outside.

**Default = first track**, not "most-recent-attempt track". Cheaper, no extra fetch, predictable. The Topbar SegmentedControl gives the user one click to switch.

### D2. Full backend extension to `GET /api/dashboard/me`

The design's daily strip wants today's plan, daily-XP target, mastery level, "+1 today" delta — none of which exist in the current payload. Frontend-only derivation would mean making up numbers (mastery curve, daily target). Backend extension keeps the mechanic in one place.

**New `DashboardResponse` shape:**

```ts
export type DashboardResponse = {
  streak: number;
  streakIncrementedToday: boolean;          // NEW
  badges: BadgeStatus[];
  rank: number | null;
  totalPoints: number;
  pointsEarnedToday: number;                // NEW
  dailyXp: { earned: number; target: number };  // NEW
  mastery: { level: number; xpInLevel: number; xpForNextLevel: number };  // NEW
  todayPlan: TodayPlan | null;              // NEW
};

export type TodayPlan = {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackTitle: string;
  title: string;
  position: number;                         // L# (1-based)
  estimatedMinutes: number;
  typeLabel: 'Concept + quiz' | 'Code + tests' | 'Concept + code' | 'Capstone';
  recommendationKind: 'continue' | 'concept_gap' | 'first_timer';
  reasonMessage: string;
  conceptHint: string | null;               // populated only on `concept_gap`, mirrors RecommendationResponse.reason.concept
};
```

**Endpoint changes:**
- `GET /api/dashboard/me` accepts optional `?trackId=`. When present, `todayPlan` is filtered to that track; if no recommendation lands on the requested track, `todayPlan: null`. Without the param, returns the best recommendation across all tracks.
- `GET /api/progress/recommendation` mirrors the same `?trackId=` filter for symmetry.

**Mechanics chosen:**
- **Mastery curve — triangular:** `xpForLevelStart(L) = 100·L·(L-1)/2`. So L1 starts at 0, L2 at 100, L3 at 300, L4 at 600, L5 at 1000, L6 at 1500. `levelFromXp(totalPoints)` returns the highest L where `xpForLevelStart(L) <= totalPoints`. `xpInLevel = totalPoints - xpForLevelStart(level)`. `xpForNextLevel = xpForLevelStart(level + 1) - totalPoints`.
- **Daily XP target — `DAILY_XP_TARGET = 20`**, exported as a service constant. Future-extensible via per-cohort config; out of scope.
- **Lesson duration estimate — per-exercise heuristic summed:** `multiple_choice = 30s, fill_blank = 60s, predict_output = 90s, code = 240s, fix_bug = 240s, capstone_submission = 1200s`. Result ceil'd to minutes, min 1. No persisted field — computed at read-time.
- **Lesson type label — composition-based:**
  - capstone present → `Capstone`
  - only `code` + `fix_bug` → `Code + tests`
  - only `multiple_choice` + `predict_output` → `Concept + quiz`
  - mix of code-ish + quiz-ish → `Concept + code`
  - empty → `Concept + quiz` (default — degenerate)
- **Streak "+1 today" delta:** server computes `streakIncrementedToday: boolean` — true when the latest streak-bumping attempt's day matches today (UTC, matching `StreakService`'s existing day convention via `toISOString().slice(0, 10)`).
- **Day window:** UTC midnight everywhere (`pointsEarnedToday`, `streakIncrementedToday`). Documented in spec; avoids per-user timezone storage. Acceptable deferral.

**New code in platform:**
- `gamification/mastery.service.ts` — pure functions; no I/O.
- `gamification/daily-xp.service.ts` — wraps `ExerciseResultRepository.sumPointsSince(studentId, sinceUtc)`.
- `gamification/today-plan.service.ts` — composes existing `ProgressAggregatorService.getRecommendation(studentId, trackId?)` + lesson position lookup + duration/type-label derivation.
- `content/lesson-insight.service.ts` — pure helpers: `estimateMinutes(exercises)`, `deriveTypeLabel(exercises)`. Lives under `content/` because both helpers operate on lesson exercise composition (a content concern); imported by gamification's `today-plan.service`.
- `state/repositories/exercise-result.repository.ts` — extended with `sumPointsSince(studentId, sinceUtc)`.
- `gamification/streak.service.ts` — extended `StreakResult` to expose `incrementedToday: boolean` (computed from existing `activeToday` logic).

**Wiring `DashboardController.getDashboard`:** after existing student/totalPoints/streak/rank computation, run new awaits in parallel via `Promise.all(...)`: `dailyXp.compute(studentId)`, `todayPlan.resolve(studentId, trackIdParam)`, `mastery.compute(totalPoints)` (sync but uniform). Empty-state fallback (no `student` row): zeros + `todayPlan: null`.

### D3. Dashboard CTA dynamically resolves; sidebar Continue Lesson stays static

The page-head's iridescent **Continue lesson NN** button links to `dash.todayPlan.lessonId` (or hides on `todayPlan: null`). Copy varies by `recommendationKind`:
- `continue` → "Continue lesson {position}"
- `concept_gap` → "Practice {conceptHint}" (uses the new `conceptHint` field on `TodayPlan`; falls back to "Brush up" when null)
- `first_timer` → "Start lesson 01"
- exhausted (`todayPlan: null`) → CTA hidden, replaced with "All caught up — review queue?" linking to `/review`

Sidebar's `ContinueLessonButton` stays at `/tracks` (Sub-project B carry-over). A future sub-project that touches lesson navigation broadly may unify both into a single dynamic resolver.

### D4. Replace `LeaderboardTable` wholesale

Design diverges enough (avatars, top-rank amber, mono columns, no streak, only top-3 + you) that wrapping the existing `<table>` would be lipstick. Single consumer, no orphans rule applies. New `MiniLeaderboard.tsx` consumes the existing `fetchLeaderboard()` data, slices `entries.slice(0, 3)`, conditionally appends the row where `studentId === myStudentId` if not already in those 3. No "See all" button — `// TODO: Sub-project F adds /leaderboard route` breadcrumb. Sub-project F builds a full-page leaderboard from scratch when it lands.

### D5. Delete `ReviewWidget`, `ConceptMastery`, `BadgesGrid`

Design omits all three from the dashboard. Sidebar's `ReviewQueueBadge` already surfaces review-due. Concept mastery and badges find permanent homes on `/profile` in Sub-project F. None has consumers outside `dashboard/page.tsx` (grep-verified). `StatsCard` also goes — replaced wholesale by `DailyStrip`'s KPI cells.

### D6. Drop `AppShell` shim usage on dashboard; build page-head from primitives

Shim renders `<Heading level="display">{title}</Heading>` + optional muted subtitle. Design wants eyebrow + display heading + muted nudge + action-button row beside the title — a composition the shim can't represent. Per the App Shell vault note, this is explicitly an option for any page-refactor PR.

`dashboard/page.tsx` builds the page-head inline from `Eyebrow` + `Heading` + `Row` + `Button` primitives wrapped in a `.page-head` div. The shim file (`components/layout/AppShell.tsx`) is **not deleted** — still consumed by 7 other authed pages. Final cleanup ships in Sub-project H.

### D7. Port the missing Sub-project B CSS slice alongside C's new classes

Sub-project B added the chrome markup (`.app`, `.side`, `.topbar`, `.main`) but never copied the corresponding styles from the design's `app.css` into `web/styles/app.css` (file is empty save for a comment). The chrome has been getting by on inline styles + `.muted`/`.mono` utilities. C's CSS port will fold in the missed B slice (no upstream design ask needed — design has every class).

Single commit early in the web plan: copy from `c:/tmp/design-bootcamp/bootcamp/project/app.css` into `web/styles/app.css`. Specific class lists in §4 below.

### D8. Two repos, two worktrees, two PRs, ordered

`web/` and `platform/` are independent git repos. Single-worktree assumption from the on-ramp doesn't hold for C.

- **Worktree 1:** `c:/tmp/bootcamp-platform-dashboard` → `platform/`'s `feat/dashboard-payload` off `master`. Ships **first**.
- **Worktree 2:** `c:/tmp/bootcamp-web-dashboard` → `web/`'s `feat/dashboard` off `master`. TDD against fixture from day one; switches to live endpoint after platform PR merges and deploys.

Single spec (this file) covers both repos. Single plan partitions tasks under `## Platform tasks` and `## Web tasks` with strict ordering.

## Architecture

### Two-repo split

```
platform/  (NestJS — git repo)
  src/gamification/
    dashboard.controller.ts    [extends payload]
    mastery.service.ts         [NEW]
    daily-xp.service.ts        [NEW]
    today-plan.service.ts      [NEW]
    streak.service.ts          [extends StreakResult]
  src/content/
    lesson-insight.service.ts  [NEW — duration + type-label helpers]
  src/state/repositories/
    exercise-result.repository.ts  [extends with sumPointsSince]
  src/progress/
    progress.service.ts        [getRecommendation accepts trackId?]
    progress.controller.ts     [honours ?trackId= query param]

web/  (Next.js — git repo)
  styles/app.css               [populated: B back-fill + C net-new]
  lib/
    track-context.tsx          [NEW — TrackProvider + useActiveTrack]
    gamification.ts            [DashboardData type widened; fetchDashboard(trackId?)]
    __fixtures__/dashboard.fixture.ts  [NEW — for TDD during gap]
  app/(authed)/
    layout.tsx                 [wraps children in <TrackProvider>]
    dashboard/page.tsx         [refactored to new composition; AppShell shim removed]
  components/
    shell/Topbar.tsx           [SegmentedControl consumes useActiveTrack; TODO removed]
    shell/ActiveTrackPill.tsx  [consumes useActiveTrack; TODO removed]
    dashboard/
      DailyStrip.tsx           [NEW]
      LessonRow.tsx            [NEW — shared primitive]
      UpNextList.tsx           [NEW]
      RecentlyCompletedList.tsx[NEW]
      PathsList.tsx            [NEW]
      MiniLeaderboard.tsx      [NEW]
      PageHead.tsx             [NEW]
      DashboardSkeleton.tsx    [NEW]
      DashboardError.tsx       [NEW]
      ReviewWidget.tsx         [DELETED]
      ConceptMastery.tsx       [DELETED]
      BadgesGrid.tsx           [DELETED]
      StatsCard.tsx            [DELETED]
      LeaderboardTable.tsx     [DELETED]
```

### Dashboard data flow

```
TrackProvider (in (authed)/layout)
  ├─ on mount: fetchTracks() → tracks
  ├─ reads localStorage['bootcamp.activeTrackId'] → trackId
  └─ exposes { trackId, setTrackId, tracks, loading }

dashboard/page.tsx
  ├─ useActiveTrack() → { trackId, tracks }
  ├─ useEffect on [trackId, tracks]:
  │   Promise.all([
  │     fetchDashboard(trackId),         → DashboardResponse w/ todayPlan
  │     fetchLeaderboard(),              → LeaderboardData
  │     fetchTrack(trackId),             → TrackDetail w/ lessons
  │     Promise.all(tracks.map(t =>      → Map<trackId, TrackProgress>
  │       fetchTrackProgress(t.id))),
  │   ])
  ├─ renders <DashboardSkeleton /> until trackId + data ready
  └─ composes: PageHead → DailyStrip → 2-col grid:
       Left:  UpNextList + RecentlyCompletedList
       Right: PathsList + MiniLeaderboard
```

### Backend service composition

```
DashboardController.getDashboard(user, ?trackId)
  ├─ student = StudentRepository.findByUserId(user.userId)
  ├─ if !student: return empty-state response
  ├─ totalPoints = ExerciseResultRepository.sumByStudent(studentId)
  ├─ streakResult = StreakService.getCurrentStreak(studentId)  // includes incrementedToday
  ├─ badges = BadgeRepository.findByStudent(studentId) + BADGES merge
  ├─ rank = aggregate over all students (existing logic)
  └─ Promise.all([
       dailyXp.compute(studentId),       → { earned, target: 20 }
       todayPlan.resolve(studentId, trackId),  → TodayPlan | null
       mastery.compute(totalPoints),     → { level, xpInLevel, xpForNextLevel }
     ])

todayPlan.resolve(studentId, trackId?)
  ├─ rec = ProgressAggregatorService.getRecommendation(studentId, trackId)
  ├─ if rec.kind === 'exhausted': return null
  ├─ exercises = LessonRepository.findExercises(rec.lesson.id, rec.lesson.version)
  ├─ position = lookup in TrackRepository.lessonOrder(rec.lesson.trackId)
  └─ return {
       lessonId, lessonVersion, trackId, trackTitle, title,
       position,
       estimatedMinutes: lessonInsight.estimateMinutes(exercises),
       typeLabel:        lessonInsight.deriveTypeLabel(exercises),
       recommendationKind: rec.kind,
       reasonMessage:    rec.reason.message,
       conceptHint:      rec.kind === 'concept_gap' ? rec.reason.concept : null,
     }

mastery.compute(totalPoints)
  ├─ level = max L where 100·L·(L-1)/2 <= totalPoints
  ├─ xpInLevel = totalPoints - xpForLevelStart(level)
  └─ xpForNextLevel = xpForLevelStart(level + 1) - totalPoints
```

## TrackContext (web)

**File:** `web/lib/track-context.tsx`

```tsx
type TrackContextValue = {
  trackId: string | null;
  setTrackId: (id: string) => void;
  tracks: TrackSummary[];
  loading: boolean;
};

const STORAGE_KEY = 'bootcamp.activeTrackId';
const TrackContext = createContext<TrackContextValue | null>(null);

export const TrackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [trackId, _setTrackId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTracks()
      .then((ts) => {
        setTracks(ts);
        const stored = readStorage();
        if (stored && ts.some((t) => t.id === stored)) _setTrackId(stored);
        else if (ts.length > 0) {
          _setTrackId(ts[0].id);
          writeStorage(ts[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const setTrackId = (id: string) => {
    _setTrackId(id);
    writeStorage(id);
  };

  return <TrackContext.Provider value={{ trackId, setTrackId, tracks, loading }}>{children}</TrackContext.Provider>;
};

export const useActiveTrack = (): TrackContextValue => {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error('useActiveTrack must be used inside <TrackProvider>');
  return ctx;
};
```

`readStorage` / `writeStorage` are SSR-safe (`typeof window !== 'undefined'`).

## CSS port (`web/styles/app.css`)

Single commit `feat(styles): port app shell + dashboard CSS from design bundle`. Verbatim copy from `c:/tmp/design-bootcamp/bootcamp/project/app.css` with section header comments.

**Sub-project B back-fill:**
- `.app` (240px sidebar grid)
- `.side`, `.side-section`, `.side-link` (incl. `:hover`, `.active` variants), `.side-icon`, `.side-link .badge`
- `.topbar`, `.topbar .search`
- `.main`, `.main-narrow`
- `.page-head`, `.page-head .h-display`
- `.seg`, `.seg-btn`, `.seg-btn:hover`, `.seg-btn.active`, `.seg-btn.active.swift`, `.seg-btn.active.kotlin`
- Light-theme overrides for `.side` and `.topbar`

**Sub-project C net-new:**
- `.daily`, `.daily::after`, `.daily-grid`
- `.lesson-row`, `.lesson-row:hover`, `.lesson-row.completed`, `.lesson-icon`, `.lesson-row.completed .lesson-icon`
- `.lb-row`, `.lb-row.you`, `.lb-rank`, `.lb-rank.top`
- `.stack`, `.stack-tight`, `.stack-loose`

**Stays out (other sub-projects):** `.tree-*` (D), `.player-*` `.hearts` `.heart` `.dnd-*` (E), `.profile-head` `.heat*` `.medal*` (F), `.pg-*` (no owner).

**Risk:** all 8 authed pages may show layout shifts after the chrome styles paint (sticky sidebar, blurred topbar, page padding). Manual sweep of each authed route is a dedicated plan task; fix-commits as needed. Grep verified `.lesson-row` and `.stack` collide with nothing.

## Components (web)

### `PageHead`

Inline composition of `Eyebrow` + `Heading` + muted `<p>` + action `Row`. Eyebrow = `track.title` (e.g. "iOS Development with SwiftUI"). Heading = `Welcome back, {firstName}.` where `firstName = user.name?.split(' ')[0]`; if `user.name` is empty/undefined, render `Welcome back.` (no comma). Muted line = "You're {N} lessons away from your next badge." where N derives from the next-unearned badge's threshold (using `BADGES` definitions); fallback "Keep up the {streak}-day streak." when no badges remain unearned. Action row = ghost "Restart streak insurance" button (`disabled` + `aria-disabled` + `title="Coming soon"`) + iridescent CTA per D3.

### `DailyStrip`

`.daily` wrapper + `.daily-grid`. Left cell: `Eyebrow style={{ color: 'var(--peacock-200)' }}>Today's plan · {min} min</Eyebrow>`, `<Heading level="2">{todayPlan.title}</Heading>`, three `Badge`s (`L{position}`, `{typeLabel}`, `{min} min` with dot). Three KPI cells use the existing `KPI` primitive:

| KPI | Value | Delta/extra |
|---|---|---|
| Streak | `streak` (with flame icon) | `streakIncrementedToday` → "+1 today"; else muted "Keep going" |
| Daily XP | `{earned} / {target}` (peacock-tinted) | `<ProgressBar value={(earned/target)*100} />` thin |
| Mastery | `L{level}` | muted "{xpForNextLevel} XP to L{level+1}" |

When `todayPlan === null` (exhausted state), renders an empty-state variant: same `.daily` wrapper, copy "All caught up — review queue?" + Review CTA button + same KPIs unchanged.

### `LessonRow`

Shared primitive. Markup `.lesson-row` (or `.lesson-row.completed`), `.lesson-icon`, title, mono meta line, optional right-side badge slot, chev icon.

```tsx
type LessonRowProps = {
  icon: IconName;
  title: string;
  meta: string;
  state: 'next' | 'queued' | 'completed';
  href: string;
  badge?: ReactNode;
  accentColor?: string;  // applied to .lesson-icon when state === 'next'
};
```

Wraps the row in a `<Link href>` so the whole row is clickable. The "next" variant gets `style={{ background: accentColor, color: '#0a0a0a', borderColor: accentColor }}` on `.lesson-icon`.

### `UpNextList`

Derives 4 lessons from `track.lessons` + `progress`. Algorithm: find index of `todayPlan.lessonId` in `track.lessons`; walk forward from there, take first 4 where `progress.lessons.find(p => p.lessonId === l.id)?.state !== 'complete'`. If `todayPlan === null`, fall back to first 4 not-complete. First row gets `state="next"` + `<Badge tone="brand" dot>Next</Badge>` + accent color = track-language tone (`var(--iris-400)` swift, `var(--amber-400)` kotlin).

Heading row: `<h3>Up next</h3>` + `<Button variant="ghost" size="sm" href="/tracks">View skill tree<Icon name="chevR" /></Button>`. Empty fallback: muted "No upcoming lessons in this track."

### `RecentlyCompletedList`

Derives last 3 from `progress.lessons` filtered to `state === 'complete'`, sorted by `lastAttemptAt` desc. Each renders `<LessonRow state="completed" icon="check" />` with `<Badge tone="success" dot>Done</Badge>`. Title comes from joining `track.lessons[].title` by id. Heading row: `<h3>Recently completed</h3>` + muted "This week" caption. Empty fallback: muted "Nothing completed yet — start with today's plan."

### `PathsList`

Maps over `tracks` from `useActiveTrack()`. For each, emits a `Card` with: row of (color dot — derived from track language: iris/amber — + track title) + mono `{done}/{total}` right-aligned + `<ProgressBar />` whose fill style uses a track-coloured `linear-gradient(90deg, {color}, var(--peacock-300))`. `done` = count of `progress.lessons.filter(l => l.state === 'complete')`; `total` = `track.lessonCount`. Locked variant deferred (no cohort gating data today). Heading: `<h3>Your paths</h3>`.

### `MiniLeaderboard`

`Card` with `card-elevated` modifier. `<h4>This week's leaderboard</h4>`. Top-3 + you logic:

```tsx
const top3 = entries.slice(0, 3);
const me = entries.find(e => e.studentId === myStudentId);
const rows = top3.some(e => e.studentId === myStudentId) ? top3 : [...top3, me].filter(Boolean);
```

Each row uses `.lb-row` markup directly (lb-rank with `.top` class for #1, `Avatar size="sm"` with initials from `name.split(' ').map(p => p[0]).join('').slice(0, 2)`, name with bold + `(you)` suffix for self, mono XP with `.toLocaleString()`). No "See all" — `// TODO: Sub-project F adds /leaderboard route` breadcrumb.

Empty-state: muted "No leaderboard entries yet."

### `DashboardSkeleton` and `DashboardError`

`Skeleton` — minimal pulse: page-head placeholder + `.daily` placeholder + 2-col placeholder. Primitives only.

`Error` — single `Card` with `<Heading level="3">Couldn't load dashboard</Heading>` + the error message + "Retry" button that re-runs the fetch. The dashboard page lifts the fetch into a `loadAll` callback so retry can re-invoke it.

## Chrome wiring (web)

### `Topbar.tsx`

```tsx
const { trackId, setTrackId, tracks, loading } = useActiveTrack();
const swiftKotlin = tracks.filter(t => t.language === 'swift' || t.language === 'kotlin');
const value = trackId ?? swiftKotlin[0]?.id ?? '';
return (
  <SegmentedControl
    value={value}
    onChange={setTrackId}
    options={swiftKotlin.map(t => ({
      value: t.id,
      label: t.language === 'swift' ? 'Swift' : 'Kotlin',
      activeClassName: t.language,
    }))}
    aria-disabled={loading}
  />
);
```

Removes the `// TODO` comment.

### `ActiveTrackPill.tsx`

```tsx
const { trackId, tracks } = useActiveTrack();
const active = tracks.find(t => t.id === trackId);
const tone = active?.language === 'kotlin' ? 'amber' : 'iris';
const label = active?.language === 'kotlin' ? 'Kotlin' : 'Swift';
return (
  <div ...>
    <Eyebrow>Active track</Eyebrow>
    <Row>
      <Badge tone={tone} dot>{label}</Badge>
      <span>{totalPoints.toLocaleString()} XP</span>
    </Row>
  </div>
);
```

Removes the `// TODO` comment + the hardcoded "Swift" badge.

### `(authed)/layout.tsx`

```tsx
return (
  <TrackProvider>
    <div className="app">
      <Sidebar />
      <div><Topbar /><main className="main">{children}</main></div>
    </div>
  </TrackProvider>
);
```

## Build sequence (ordered)

### Phase 0 — fixtures (single web commit, before any TDD)

1. Add `web/lib/__fixtures__/dashboard.fixture.ts` with full `DashboardResponse` shape per D2 (sample values for both `continue` and `exhausted` kinds).

### Phase 1 — platform/ first (`feat/dashboard-payload`)

1. `mastery.service.ts` + spec (TDD: spec first, boundary table)
2. `lesson-insight.service.ts` + spec (estimateMinutes + deriveTypeLabel exhaustive)
3. `daily-xp.service.ts` + spec (UTC-day window assertions)
4. `exercise-result.repository.ts` extension (`sumPointsSince`) + repo test
5. `streak.service.ts` extension (`incrementedToday`) + spec extension
6. `today-plan.service.ts` + spec (each recommendation kind, `?trackId=` mismatch)
7. `progress.service.ts` `getRecommendation` accepts `trackId?` + spec extension
8. `progress.controller.ts` honours `?trackId=` + e2e test
9. `dashboard.controller.ts` extends payload + new service wiring + supertest extension
10. Lint + Jest + build green → PR → review → merge to platform `master`

### Phase 2 — web/ in parallel from day one (`feat/dashboard`)

1. CSS port commit (D7) + manual sweep of all 8 authed routes for layout regressions
2. `lib/track-context.tsx` + tests
3. Mount `<TrackProvider>` in `(authed)/layout.tsx`; update `Topbar` + `ActiveTrackPill` consumers + extend their tests
4. `lib/gamification.ts` type widening + `fetchDashboard(trackId?)`
5. `LessonRow.tsx` + tests
6. `DailyStrip.tsx` + tests
7. `UpNextList.tsx` + tests
8. `RecentlyCompletedList.tsx` + tests
9. `PathsList.tsx` + tests
10. `MiniLeaderboard.tsx` + tests
11. `PageHead.tsx` + tests
12. `DashboardSkeleton.tsx`, `DashboardError.tsx`
13. Refactor `app/(authed)/dashboard/page.tsx` to new composition; orchestrator test
14. Delete the 5 retired files + their tests; vault note update for removed components
15. E2E `dashboard.spec.ts` + run full Playwright suite
16. `npm run lint && npm test && npm run build` green → PR → review → merge to web `master`

### Sub-agent batching (per A/B convention)

When a phase-2 task and its tests are fully specified in the plan, dispatch as a single `subagent-driven-development` job:

- Batch 1 (foundational): CSS port + TrackContext + chrome wiring (steps 1-3)
- Batch 2 (data layer): gamification.ts widening + LessonRow (steps 4-5)
- Batch 3 (panels): UpNext + RecentlyCompleted + Paths + MiniLeaderboard (steps 7-10) — independent, parallel-safe
- Batch 4 (composition): DailyStrip + PageHead + page refactor + deletions + e2e (steps 6, 11-15)

Phase 1 platform tasks are mostly sequential (later services depend on earlier ones) — dispatched one or two at a time.

## Testing

### Platform (Jest)

- `mastery.service.spec.ts` — boundary table: `[0→L1, 99→L1, 100→L2, 299→L2, 300→L3, 599→L3, 600→L4, 999→L4, 1000→L5]` plus `xpInLevel` and `xpForNextLevel` math.
- `lesson-insight.service.spec.ts` — `estimateMinutes` per exercise type, mixed lesson, empty list returns 1; `deriveTypeLabel` for each combination.
- `daily-xp.service.spec.ts` — yesterday's points excluded, today's included, no attempts → 0, multiple attempts in same day summed.
- `today-plan.service.spec.ts` — each `recommendationKind` hydrates correctly; `exhausted` returns null; `?trackId=` mismatch returns null; lesson position lookup correct.
- `streak.service.spec.ts` extension — `incrementedToday` true when latest attempt is today, false when yesterday.
- `exercise-result.repository.spec.ts` extension — `sumPointsSince` correct boundary handling.
- `dashboard.controller.spec.ts` extension — supertest asserts new fields present + correct shape; `?trackId=` filter test; empty-student fallback unchanged.

### Web (Vitest + Playwright)

- `lib/track-context.test.tsx` — initial null, localStorage round-trip, default-to-first-track on empty storage, sticky after `setTrackId`, missing-tracks-array fallback.
- `shell/Topbar.test.tsx` extension — SegmentedControl options reflect `tracks`; click calls `setTrackId`; respects `loading`.
- `shell/ActiveTrackPill.test.tsx` extension — badge tone changes with active track; renders track title; null trackId state.
- `dashboard/LessonRow.test.tsx` — three states render correct classes, href works, accentColor inline-style applied, badge slot honoured.
- `dashboard/DailyStrip.test.tsx` — full state, exhausted state, KPIs render correct values, "+1 today" delta only when `streakIncrementedToday`.
- `dashboard/UpNextList.test.tsx` — derivation logic with fixture: 4 lessons selected, complete ones skipped, first row gets "Next" badge + accent color, navigation to `/lesson/{id}`.
- `dashboard/RecentlyCompletedList.test.tsx` — last 3 sorted by lastAttemptAt desc, empty-state copy.
- `dashboard/PathsList.test.tsx` — color-tone mapping by track language, percentage math, multiple tracks, locked variant absent.
- `dashboard/MiniLeaderboard.test.tsx` — top-3 + you appended when rank > 3, you NOT duplicated when in top-3, top-rank amber styling, empty-state, `(you)` suffix.
- `dashboard/PageHead.test.tsx` — eyebrow shows course, heading interpolates firstName, CTA copy varies by `recommendationKind`, "Continue lesson 08" interpolates `position`, fallback when `todayPlan === null`.
- `dashboard/page.test.tsx` — orchestrator: renders skeleton until trackId, calls all 4 endpoints in parallel, passes data to children, error path renders DashboardError, retry re-runs fetch.

**E2E:** new `web/tests/e2e/dashboard.spec.ts` — smoke that `/dashboard` renders the daily strip, an Up next row, and a path card without console errors. Runs in same Playwright suite as the design-system smoke.

## Verification before each PR

- **Platform:** `npm test` green, `npm run build` green, manual `curl /api/dashboard/me` against running container with seeded fixture user to confirm shape.
- **Web:** `npm run lint`, `npm test`, `npm run build` all green, manual smoke at `/dashboard` in dev with platform PR's deployed payload (after Phase 1 ships).

## Merge cleanup chain

1. Platform `feat/dashboard-payload` → platform `master` (`--no-ff`, `merge: dashboard payload extension`)
2. Web `feat/dashboard` → web `master` (`--no-ff`, `merge: dashboard refactor`)
3. Web `master` → web `feat/adaptive-next-lesson` (wip-snapshot first if dirty — same pattern as B's `73af735`)
4. Check platform for any active WIP branch; mirror the chain there if present
5. Update `vault/Architecture/`, `vault/Decisions/UI Refactor Roadmap.md` (mark C done, point D at the new `TrackContext` carry-over closure), `docs/superpowers/HANDOVER.md`, and `docs/superpowers/NEXT-SESSION-PROMPT.md` to point at Sub-project D (Tracks / Skill Tree)

## Out of scope

- `/profile` route (Sub-project F) — concept mastery + badges live there
- `/leaderboard` route (Sub-project F) — full-page leaderboard built from scratch
- Sidebar `ContinueLessonButton` dynamic resolution — stays at `/tracks` until a future sub-project unifies it
- Streak insurance feature — button rendered disabled with "Coming soon" tooltip
- Per-cohort dailyXp targets — `DAILY_XP_TARGET = 20` constant for now
- Per-user timezone for "today" window — UTC midnight everywhere
- Locked-path variant — no cohort gating data exists today
- Lesson "type" persisted as a column — derived at read-time
- Visual regression baseline tooling

## Carry-overs to D and beyond

- `TrackContext` is now in place; D consumes it (track-aware skill tree). No further lifting needed.
- Sidebar `ContinueLessonButton` → dynamic resolver — still deferred; any future lesson-navigation sub-project may take this on.
- AppShell shim deletion remains for Sub-project H cleanup.
- Per-cohort `DAILY_XP_TARGET` configurability — open for whichever sub-project introduces cohort settings.

## Source of truth

- This spec: `docs/superpowers/specs/2026-05-02-dashboard-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-02-dashboard-plan.md` (to be written next via `superpowers:writing-plans`)
- Roadmap: `vault/Decisions/UI Refactor Roadmap.md`
- Prior specs: `docs/superpowers/specs/2026-05-01-ui-foundation-design.md`, `2026-05-01-app-shell-design.md`
