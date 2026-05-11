# Dashboard

## Purpose

The `/dashboard` route — landing page for authed users. Sub-project C of the UI refactor (merged 2026-05-02). Renders the design's daily strip + Up next + Recently completed + Your paths + mini leaderboard composition, hydrated from a single extended `GET /api/dashboard/me` payload.

## Owns

- `web/app/(authed)/dashboard/page.tsx` — orchestrator (4-way `Promise.all` fetch, skeleton/error gating, 2-col composition)
- `web/components/dashboard/` — `PageHead`, `DailyStrip`, `LessonRow` (shared primitive), `UpNextList`, `RecentlyCompletedList`, `PathsList`, `MiniLeaderboard`, `DashboardSkeleton`, `DashboardError`
- `web/lib/track-context.tsx` — `TrackProvider` + `useActiveTrack` hook (lifted in C; mounts in `(authed)/layout.tsx`; persists to `localStorage['bootcamp.activeTrackId']`)
- `web/lib/__fixtures__/dashboard.fixture.ts` — typed `DashboardData` fixtures (continue / exhausted / concept_gap)
- `platform/src/gamification/mastery.service.ts` — pure triangular XP curve (`100·L·(L-1)/2`)
- `platform/src/gamification/daily-xp.service.ts` — wraps `ExerciseResultRepository.sumPointsSince`; exports `DAILY_XP_TARGET = 20`
- `platform/src/gamification/today-plan.service.ts` — composes recommendation + lesson lookup + insight derivation into a `TodayPlan`
- `platform/src/content/services/lesson-insight.service.ts` — pure helpers: `estimateMinutes` + `deriveTypeLabel` from exercise composition

## Key Interfaces

- **`GET /api/dashboard/me?trackId=`** → `DashboardResponse` with `streak`, `streakIncrementedToday`, `badges`, `rank`, `totalPoints`, `pointsEarnedToday`, `dailyXp { earned, target }`, `mastery { level, xpInLevel, xpForNextLevel }`, `todayPlan: TodayPlan | null`. The optional `?trackId=` filters `todayPlan` to that track (returns `null` when no recommendation lands there).
- **`GET /api/progress/recommendation?trackId=`** → mirrors the same `?trackId=` filter on the underlying recommendation endpoint.
- **`useActiveTrack()`** → `{ trackId: string | null, setTrackId: (id) => void, tracks: TrackSummary[], loading: boolean }`. Initial trackId is `null` (no SSR/localStorage read on first render); resolved in `useEffect` after `fetchTracks()` lands.
- **`LessonRow`** primitive — props `{ icon, title, meta, state: 'next' | 'queued' | 'completed', href, badge?, accentColor? }`. Wraps in a `<Link>` for keyboard accessibility. `accentColor` applies to `.lesson-icon` only when `state === 'next'`.

## Mechanics chosen

- **Mastery curve:** triangular `xpForLevelStart(L) = 100·L·(L-1)/2`. L1=0, L2=100, L3=300, L4=600, L5=1000, L6=1500.
- **Daily XP target:** `DAILY_XP_TARGET = 20` (server constant; per-cohort configurability deferred).
- **Lesson duration estimate:** per-exercise heuristic summed: `multiple_choice=30s, fill_blank=60s, predict_output=90s, code=240s, fix_bug=240s, capstone_submission=1200s`. Result ceil'd to minutes, min 1.
- **Lesson type label:** composition-based — capstone present → `Capstone`; mix → `Concept + code`; only code/fix-bug → `Code + tests`; else → `Concept + quiz`.
- **"+1 today" delta:** server flag `streakIncrementedToday`, currently equal to `activeToday` (semantic alias kept distinct for future divergence).
- **Day window:** UTC midnight everywhere (`pointsEarnedToday`, `streakIncrementedToday`).

## Dependencies

- `web/components/ui/` (primitives library — Sub-project A)
- `web/components/shell/` (chrome — Sub-project B; Topbar + ActiveTrackPill consume `useActiveTrack`)
- `web/lib/tracks.ts` (`fetchTracks`, `fetchTrack`)
- `web/lib/progress.ts` (`fetchTrackProgress`, `TrackProgress` type)
- `platform/src/progress/progress.service.ts` (`getRecommendation` extended with optional `trackId`)
- `platform/src/content/repositories/lesson.repository.ts` (`findByVersionWithBlocks`)
- `platform/src/content/repositories/exercise.repository.ts` (`findByVersion`, batched in parallel)
- `platform/src/state/repositories/exercise-result.repository.ts` (`sumPointsSince` — uses `firstPassedAt: { gte: sinceUtc }`)

## Conventions

- The dashboard page does NOT wrap in `<AppShell>` — `PageHead` builds the page header directly from primitives.
- Track-color mapping: swift → `var(--iris-400)` / `iris` badge tone; kotlin → `var(--amber-400)` / `amber` badge tone; fallback → `var(--peacock-400)` / `iris`.
- All four data fetches (`fetchDashboard`, `fetchLeaderboard`, `fetchTrack`, per-track `fetchTrackProgress`) run in parallel via `Promise.all`. Failure of any surfaces in `<DashboardError onRetry={loadAll} />`.
- `MiniLeaderboard` shows top-3 + you (if user not in top-3). No "See all" button until Sub-project F creates `/leaderboard`.

## Carry-overs to D and beyond

- **TrackContext** is now in place; D consumes it for the skill tree.
- **Sidebar ContinueLessonButton** still hardcodes `/tracks`; future sub-project may unify with `todayPlan` resolution.
- **Per-cohort `DAILY_XP_TARGET`** configurability deferred.
- **AppShell shim deletion** — slated for Sub-project H cleanup (still consumed by 7 other authed pages).
