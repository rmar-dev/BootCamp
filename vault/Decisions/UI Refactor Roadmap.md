# UI Refactor Roadmap

## Goal

Replace the unstyled Tailwind `bg-gray-*` UI in `web/` with the peacock-inspired design system from the upstream Claude Design bundle (`bootcamp/project/`). Ship as a sequence of focused PRs — one foundation, then page-by-page — rather than one mega-refactor.

## Source design

- Bundle path: `c:/tmp/design-bootcamp/bootcamp/project/` (extracted from `https://api.anthropic.com/v1/design/h/xdfSZ5oLo5Cg4NIsv_5apA`)
- Authoring intent (from chat transcript): dark-mode-first developer learning platform; original design, not a clone of any specific brand
- Core idea: tokens.css → components.css → app.css; class-based primitives; theme via `[data-theme]`, density via `[data-density]`

## Decision: foundation-first, PR-by-PR

Decomposed into 8 sub-projects. Each gets its own spec → plan → branch → review → merge cycle. PRs stack independently after Sub-project A.

| Sub-project | Scope | Status |
|---|---|---|
| **A. UI Foundation** | Design tokens, primitives library at `components/ui/`, theme/density mechanism, `/design-system` showcase | **Done** (merged 2026-05-01) |
| **B. App Shell** | New Sidebar + Topbar at `components/shell/`, route-group `app/(authed)/layout.tsx` with auth gate, SettingsMenu rebuilt with Density toggle, AppShell reduced to a heading-bar shim. RevisitIcon was found to be a per-lesson concern and stayed out of scope; CohortBadge is unused. | **Done** (merged 2026-05-01) |
| **C. Dashboard** | Port the design's daily strip + up-next + paths + mini-leaderboard. Touches `app/(authed)/dashboard/page.tsx`, `components/dashboard/`. Also lifted `TrackContext` and extended platform's `GET /api/dashboard/me` payload (todayPlan, dailyXp, mastery, streakIncrementedToday). | **Done** (merged 2026-05-02 at web `master` `879211c` and platform `master` `a376a48`) |
| **D. Tracks / Skill Tree** | Replace `components/tracks/TimelineLessonNode.tsx` with `SkillNode`-based sectioned tree. Touches `app/(authed)/tracks/`, `app/(authed)/tracks/[id]/`. Consumes the existing `TrackContext` (lifted in C). | Next |
| E. Lesson Player | Wrap each `components/lesson/renderers/*` exercise type in primitives (CodeBlock, DnDSlot/Token, multiple-choice, hearts, progress). Largest sub-project — five exercise types plus the wrapper | After D |
| F. Profile / Badges / Leaderboard | Heatmap, mastery rings, badge collection, ranked list. May introduce `/profile` and `/leaderboard` routes (Sub-project B's sidebar currently routes "Profile" → `/badges` and "Leaderboard" → `/dashboard#leaderboard` as stand-ins) | After E |
| G. Instructor pages | Queue table, review form, review thread | After F |
| H. Auth pages | Login, register | After G |

After H ships, retire the `darkMode: 'class'` Tailwind setting and the legacy `bg-gray-*` / `dark:bg-gray-*` classes. The `[data-theme]` system becomes the only switch.

## Why this order

- **B first** because every page-refactor PR after B wraps in the new AppShell; doing pages before B means rewriting the wrapper twice.
- **C → D → E** follows the user's daily journey: arrive at dashboard → pick a track → enter a lesson. Visual continuity matters between these three.
- **E is biggest** so it sits in the middle where pace is highest — by then the team understands the primitives' edges. Five exercise renderers (`CodeExercise`, `FillBlankExercise`, `FixBugExercise`, `MultipleChoiceExercise`, `PredictOutputExercise`, `CapstoneSubmissionExercise`) plus `BlockList`, `ExerciseBlock`, `LessonNavigation`.
- **F-H last** are lower-traffic pages. Auth pages last because they ship on a fresh visit and cost the most if they break.

## Coexistence during the refactor

- Foundation kept the existing `dark`-class Tailwind theming in place. Both systems repaint together (theme toggle drives both `.dark` and `[data-theme]`).
- Lint discipline: files in `components/ui/` may not use Tailwind utility classes for color/typography. Files outside `components/ui/` may not introduce new `.btn`/`.card`/`.badge`/etc. usages until they consume the corresponding primitive.
- After H ships, both rules collapse — only the design system remains.

## Source of truth

- Spec for Sub-project A: `docs/superpowers/specs/2026-05-01-ui-foundation-design.md`
- Plan for Sub-project A: `docs/superpowers/plans/2026-05-01-ui-foundation-plan.md`
- Spec for Sub-project B: `docs/superpowers/specs/2026-05-01-app-shell-design.md`
- Plan for Sub-project B: `docs/superpowers/plans/2026-05-01-app-shell-plan.md`
- Spec for Sub-project C: `docs/superpowers/specs/2026-05-02-dashboard-design.md`
- Plan for Sub-project C: `docs/superpowers/plans/2026-05-02-dashboard-plan.md`
- Each later sub-project gets its own `YYYY-MM-DD-<sub-project>-design.md` and `-plan.md`.

## Carry-overs into next sub-projects

- **`TrackContext` is in place.** Sub-project C lifted the active-track selection into `web/lib/track-context.tsx`. Topbar SegmentedControl + Sidebar ActiveTrackPill now consume it. Default = first track; user toggles via the topbar; selection persists in `localStorage['bootcamp.activeTrackId']`. Sub-project D (Tracks / Skill Tree) consumes the same hook for its track filtering — no further lifting needed.
- **Recommendation endpoint accepts `?trackId=`.** `GET /api/progress/recommendation?trackId=` and `GET /api/dashboard/me?trackId=` filter to the requested track (Sub-project C). Useful for D when fetching track-specific recommendations.
- **Continue Lesson dynamic resolution.** Sidebar `ContinueLessonButton` still hardcodes `href="/tracks"`. The dashboard's page-head CTA in C uses `dash.todayPlan.lessonId` for dynamic resolution; the sidebar version can be unified by any future sub-project that touches lesson navigation broadly.
- **Per-cohort `DAILY_XP_TARGET` configurability.** Currently a server constant (`20`) in `gamification/daily-xp.service.ts`. Open for whichever sub-project introduces cohort settings.
- **Hearts mechanic** — Sub-project E (Lesson Player) introduces hearts. Topbar deliberately does not render them; lesson player will.
- **Profile + Leaderboard routes** — Sub-project F should create `/profile` (concept mastery + badges, removed from dashboard in C) and `/leaderboard` (full-page replacement for the mini one in C). Sidebar links currently point at `/badges` and `/dashboard#leaderboard`.
- **AppShell shim deletion** — C dropped shim usage on the dashboard. The shim file (`components/layout/AppShell.tsx`) still serves the other 7 authed pages and gets deleted in Sub-project H's cleanup.
