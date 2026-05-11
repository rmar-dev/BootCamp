# Next session prompt — Sub-project G (Instructor pages)

Sub-project F (Profile + Leaderboard) is **fully merged** as of 2026-05-05:
- Web `master` `f439401` (15 commits via `feat/profile`, rebased onto `303f7b2` then ff-merged; includes `db2e3dd` sidebar repoint Profile → /profile, Leaderboard → /leaderboard)
- Platform `master` `ac9d56c` (9 commits via `feat/profile-payload`)
- Worktree `c:/tmp/bootcamp-web-profile` removed; `feat/profile` branch deleted

Web tests at 376. Platform tests at 398. Stack expectations:
- **Platform on `:3002`** (not `:3000` — TileWebApp squats on `:3000`)
- **Web on `:3001`**, with `web/.env.local` setting `NEXT_PUBLIC_API_BASE=http://localhost:3002`
- Postgres `:5433`

If `dev.ps1` is rerun, pass `-ApiPort 3002` so it picks the free port. See memory `project_dev_ports.md`.

---

## Phase A — Brainstorm + spec for G (Instructor pages)

The design bundle (`docs/superpowers/design/`) has `app-shell.jsx`, `app-dashboard.jsx`, `app-tree.jsx`, `app-lesson.jsx`, `app-profile.jsx` — **no dedicated `app-instructor.jsx`**. Two paths:

1. **Designed but rendered by role** — instructor pages may be variants inside the existing shell, gated by `user.role === 'instructor' | 'admin'`. The current `web/app/(authed)/(shell)/instructor/` route already exists with platform endpoints (see `InstructorReviewController` at `platform/src/state/controllers/instructor-review.controller.ts` — routes `GET /api/instructor/queue`, `GET /api/instructor/queue/reviewed`, `GET /api/instructor/attempt/:id`, `PUT /api/instructor/approve/:id`, `POST /api/instructor/review`, `PUT /api/instructor/review/:id`, `GET /api/instructor/review/:attemptId`, `POST /api/instructor/review/:id/messages`). Inspect `web/app/(authed)/(shell)/instructor/` to see what's rendered today.

2. **Brainstorm fresh** — if the instructor experience hasn't been designed yet, run the `superpowers:brainstorming` skill to scope the surface (cohort overview, queue, individual review threads, capstone grading hand-off).

**Recommended:** start with `superpowers:brainstorming` — share whatever exists today + the platform endpoints + gamification/grading domain context, and let the brainstorm settle the surface before writing the spec.

## Phase B — Spec → Plan → Execute

Once Phase A produces a brainstorm, follow the established sub-project pattern:
1. Spec at `docs/superpowers/specs/2026-05-XX-instructor-design.md`
2. Plan at `docs/superpowers/plans/2026-05-XX-instructor-plan.md` (numbered tasks)
3. Worktree off web master at `c:/tmp/bootcamp-web-instructor/` on `feat/instructor`
4. If platform-side schema/endpoint changes are needed, parallel branch in platform/ at `feat/instructor-payload`
5. Execute via `superpowers:subagent-driven-development` or sequentially
6. Sweep (`tsc --noEmit`, `vitest run`, `lint`) → merge → update memory + this file

## Project conventions reminder

- Two-repo workflow: `c:/Users/ricma/BootCamp/web` and `c:/Users/ricma/BootCamp/platform` are independent git repos. Local-only merges (no remote, no PRs).
- Worktree pattern off web master, branch `feat/<name>`.
- Test path convention: `tests/<area>/X.test.tsx` — vitest config has `include: ['tests/**/*.test.{ts,tsx}']`.
- Auto-accept on technical recommendations within agreed scope. Brainstorming / spec / plan transitions still gated by explicit "y" / "go".
- Co-Authored-By trailer: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- The `(authed)/(shell)/` route group is for shelled pages; `(authed)/(immersive)/` is reserved for full-bleed views (currently only the lesson player).

## Open follow-ups carried from F

These are not blockers for G but should be picked up at a sensible moment:

1. **Cookie-serialization consistency.** Lesson page uses `cookies().getAll().map(...).join('; ')` (explicit form, since master `303f7b2`); profile and leaderboard pages still use `cookies().toString()` (simpler form, from F branch pre-rebase). Functionally identical in Next.js 14, but a 5-line cleanup that aligns the three server components would be nice hygiene.
2. **Track-language badge labels.** `ProfileHead` shows short labels ("Swift" / "Kotlin") instead of design's "Swift learner" / "Kotlin learner". Cosmetic, defer.

## Past sub-projects (for reference)

- **A — UI Foundation.** Spec `2026-05-01-ui-foundation-design.md`, plan `2026-05-01-ui-foundation-plan.md`. Merged 2026-05-01 at master `806fed0`. 33 commits, 191 web tests added.
- **B — App Shell.** Spec `2026-05-01-app-shell-design.md`, plan `2026-05-01-app-shell-plan.md`. Merged 2026-05-01 at master `c4b4483`. 19 commits, 222 web tests total.
- **C — Dashboard.** Spec `2026-05-02-dashboard-design.md`, plan `2026-05-02-dashboard-plan.md`. Merged 2026-05-02 at web master `879211c` and platform master `a376a48`. Two-repo / two-PR sub-project.
- **D — Tracks / Skill Tree.** Spec `2026-05-03-tracks-design.md`, plan `2026-05-03-tracks-plan.md`. Merged 2026-05-04 at web master `33b8d40`. Web-only.
- **E — Lesson Player.** Spec `2026-05-04-lesson-player-design.md`, plan `2026-05-04-lesson-player-plan.md`. Merged 2026-05-04 at web master `34087ea` / platform master `bbf4f5f`, then `feat/lesson-fixups` brought web master to `b3c510e`, then cookie-forwarding fixes brought it to `303f7b2`.
- **F — Profile + Leaderboard.** Spec `2026-05-04-profile-leaderboard-design.md`, plan `2026-05-04-profile-leaderboard-plan.md`. Merged 2026-05-05 at web master `f439401` / platform master `ac9d56c`. Two-repo. The "lesson 401" blocker that delayed merge turned out to be TileWebApp squatting on platform's port — see memory `project_dev_ports.md`.
