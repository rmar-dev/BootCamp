# BootCamp Platform — Handover

**Date:** 2026-05-02
**Status:** Platform feature-complete (10 specs). UI refactor sub-projects A (Foundation), B (App Shell), and C (Dashboard) merged. Sub-projects D–H pending.
**Platform:** `master` at `a376a48` (Dashboard payload extension merge). 194 + new dashboard service tests. `feat/adaptive-next-lesson` fast-forwarded to master.
**Web:** `master` at `879211c` (Dashboard refactor merge). **261 tests** across 69 files. Clean build. `feat/adaptive-next-lesson` at `3c288cd` (master + prior WIP).
**Curriculum:** `master` at `5309626`. 68 tests.

## Most recent change — Dashboard refactor (sub-project C of UI refactor)

Merged 2026-05-02. Spans both repos: platform `master` at `a376a48` (12 commits + merge, `feat/dashboard-payload`) and web `master` at `879211c` (16 commits + merge, `feat/dashboard`). Brought:

**Platform side (`platform/feat/dashboard-payload`):**
- New services: `MasteryService` (triangular XP curve), `DailyXpService` (UTC-day window + `DAILY_XP_TARGET = 20`), `TodayPlanService` (composes recommendation + lesson lookup + insight), `LessonInsightService` (duration + type-label heuristic).
- Repo extension: `ExerciseResultRepository.sumPointsSince(studentId, sinceUtc)` filters on `firstPassedAt`.
- `StreakService.StreakResult` extended with `incrementedToday: boolean` for the "+1 today" UI delta.
- `GET /api/dashboard/me?trackId=` returns the extended payload (`streakIncrementedToday`, `pointsEarnedToday`, `dailyXp`, `mastery`, `todayPlan`).
- `GET /api/progress/recommendation?trackId=` mirrors the same filter.

**Web side (`web/feat/dashboard`):**
- `web/lib/track-context.tsx` — `TrackProvider` mounted in `(authed)/layout.tsx`; sidebar pill + topbar SegmentedControl now wired (B's TODOs resolved).
- `web/styles/app.css` populated — back-fills the chrome layout classes B referenced and adds C's `.daily/.lesson-row/.lb-row/.stack`.
- 7 new dashboard components (`PageHead`, `DailyStrip`, `LessonRow`, `UpNextList`, `RecentlyCompletedList`, `PathsList`, `MiniLeaderboard`) plus `DashboardSkeleton` + `DashboardError`.
- 5 obsolete components deleted (`StatsCard`, `BadgesGrid`, `ConceptMastery`, `ReviewWidget`, `LeaderboardTable`).
- `dashboard/page.tsx` rewritten as a 4-way `Promise.all` orchestrator; drops `<AppShell>` shim usage.
- E2E `dashboard.spec.ts` smoke added.

Spec: `docs/superpowers/specs/2026-05-02-dashboard-design.md`
Plan: `docs/superpowers/plans/2026-05-02-dashboard-plan.md`
System note: `vault/Systems/Dashboard.md`
Roadmap: `vault/Decisions/UI Refactor Roadmap.md`

## Previous change — App Shell migration (sub-project B of UI refactor)

Merged 2026-05-01 (`master` `c4b4483`). 19 commits from `feat/app-shell` plus the merge commit. Brought:

- New chrome at `web/components/shell/` (Sidebar + Topbar + helpers, all built from primitives).
- `app/(authed)/` route group with `layout.tsx` rendering chrome + auth-gate redirect.
- 8 auth-gated pages moved into `app/(authed)/` via `git mv` (URLs unchanged because the `(authed)` segment is a Next.js route group).
- `SettingsMenu` rebuilt with primitives, routed through `useTweaks`, new Density toggle, optional `anchored`/`onClose` props.
- `AppShell.tsx` reduced to a per-page heading-bar shim (the 8 callers untouched).
- Plan-bug fix: `ReviewQueueBadge` aligned with the real `fetchReviewQueue` shape (`due`, not `queue`).

Page bodies unchanged. Sub-projects C–H refactor each page in turn while wrapping in this new chrome.

Spec: `docs/superpowers/specs/2026-05-01-app-shell-design.md`
Plan: `docs/superpowers/plans/2026-05-01-app-shell-plan.md`
System note: `vault/Systems/App Shell.md`
Roadmap: `vault/Decisions/UI Refactor Roadmap.md`

## Previous change — UI Foundation (sub-project A)

Merged 2026-05-01 (`master` `806fed0`). 33 commits from `feat/ui-foundation`. Design tokens + 26 primitives at `web/components/ui/` + `useTweaks` + `/design-system` showcase. Detail at [`vault/Systems/UI Foundation.md`](../../vault/Systems/UI Foundation.md).

## Specs completed

| # | Spec | Key deliverables |
|---|---|---|
| 1 | Content & curriculum model | Prisma schema, Track/Lesson/Exercise repos, PublishService, ScoringService, 5+1 exercise types |
| 2 | Lesson runtime (web IDE shell) | Next.js 14 web app, two-pane lesson page, Monaco editor, 6 renderers, client-side check |
| 3 | Code execution backend | Docker sidecars (Swift 5.10 + Kotlin 1.9.25), `POST /api/run`, DockerRunner, RunnerService with semaphore |
| 4 | Auth + cohorts | User entity, Passport.js (local + Google OAuth), JWT httpOnly cookies, login/register pages, protected `/api/run` |
| 5 | Submission + grading | `POST /api/submit` (all 6 types), server-side check, AttemptService, ScoringService wired, points in UI, `GET /api/progress/me` |
| 6 | Gamification | Streaks (derived), 8 badges, leaderboard, `/dashboard` page, badge unlocks inline |
| 7 | AI code review | Provider-agnostic ReviewModule, fire-and-forget after code submissions, `GET /api/reviews/:attemptId` polling, AIReview component. Configured for Gemma 4 via local Ollama. |
| 8 | Human instructor review | InstructorReviewModule, review queue, markdown feedback + conversation threads, instructor dashboard, student-facing component. |
| 9 | Curriculum authoring tooling | Standalone compiler at `curriculum/`. Markdown-with-frontmatter → Prisma DB. Content-addressed hashing for versioning. `--publish` flag. 6 exercise types supported. Sample Swift Fundamentals track with 2 lessons. |
| 10 | Capstone bridge | `capstone_submission` exercise type, instructor-gated pass/fail via `PUT /api/instructor/approve`, `starterRepoUrl` on Track, `CapstoneSubmissionExercise` renderer, adapted instructor review page with approve button, curriculum compiler support. |
| **A** | **UI Foundation** | Design tokens + 26 primitives at `components/ui/` + `useTweaks` + `/design-system` showcase. Merged 2026-05-01. |
| **B** | **App Shell** | New Sidebar + Topbar at `components/shell/` + route group `app/(authed)/` + SettingsMenu rebuilt with Density. Spec: `2026-05-01-app-shell-design.md`. Merged 2026-05-01. |
| **C** | **Dashboard** | Daily strip + Up next + Paths + Mini leaderboard. Lifted TrackContext. Extended `GET /api/dashboard/me` payload. Spec: `2026-05-02-dashboard-design.md`. Merged 2026-05-02. |

## UI refactor — remaining sub-projects

| # | Sub-project | Status |
|---|---|---|
| D | Tracks / Skill Tree refactor (replaces TimelineLessonNode with SkillNode) | **Next** |
| E | Lesson Player refactor (5 exercise renderers + wrapper, hearts mechanic) | After D |
| F | Profile / Badges / Leaderboard refactor (may introduce /profile + /leaderboard routes) | After E |
| G | Instructor pages refactor | After F |
| H | Auth pages (login/register) refactor | After G |

Full reasoning at `vault/Decisions/UI Refactor Roadmap.md`. Each sub-project follows the same spec → plan → branch → execute → merge cycle as A and B.

**Carry-overs from C that future sub-projects pick up:**
- **TrackContext is in place** — Sub-project D consumes the existing `useActiveTrack()` hook for the skill tree.
- **Recommendation endpoint accepts `?trackId=`** — useful for D when fetching track-specific recommendations.
- Sidebar `ContinueLessonButton` still hardcodes `/tracks`; dashboard's page-head CTA already does dynamic `/lesson/[id]` resolution. A future sub-project that touches lesson navigation broadly may unify them.
- Per-cohort `DAILY_XP_TARGET` configurability — currently hardcoded to 20 server-side. Open for whichever sub-project introduces cohort settings.
- Hearts mechanic — Sub-project E only.
- `/profile` and `/leaderboard` standalone routes — Sub-project F (concept mastery + badges + full-page leaderboard).
- AppShell shim (`components/layout/AppShell.tsx`) — still consumed by 7 other authed pages; deletion in Sub-project H cleanup.
- `CohortBadge.tsx` cleanup (unused) — any cleanup PR.

## How to run

```powershell
cd c:\Users\ricma\BootCamp
.\dev.bat
```

Brings up Postgres + Swift/Kotlin runners, seeds Hello BootCamp, publishes Swift Fundamentals curriculum, spawns API on `:3000` and web on `:3001` in separate windows.

Visit:
- http://localhost:3001 — main app (now with new chrome)
- http://localhost:3001/design-system — primitives showcase
- http://localhost:3001/dashboard — student dashboard inside the new shell

## How to test

```powershell
cd platform; npm test              # ~230+ passing (DB-free)
cd web; npm test                   # 261 passing
cd web; npm run build              # clean build
cd curriculum; npx vitest run      # 68 passing
```

## Test totals

| Repo | Tests | Suites |
|------|-------|--------|
| Platform | ~230+ (DB-free; e2e require local Postgres) | 40+ |
| Web | 261 | 69 |
| Curriculum | 68 | 4 |
| **Total** | **~559+** | **113+** |

(Platform DB-required suites need `docker compose up -d postgres` to run; counts above reflect DB-free suites.)
