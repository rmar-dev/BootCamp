# Design — agent-browser QA Harness for BootCamp Web

**Date:** 2026-06-04
**Status:** Approved (design phase)
**Author:** Claude (with ricmarab)

## Problem

The BootCamp web app already has Playwright e2e (16 specs, ~101/103 passing) covering
scripted assertions. We want a second, complementary automation layer driven by the
`agent-browser` CLI (Vercel Labs, v0.27.0, installed globally) that:

1. Provides a **deterministic smoke harness** — fast, CLI-native, LLM-free batch replay
   of core flows for pre-merge checks.
2. Provides **AI exploratory QA journeys** — an agent walks real user flows across roles,
   captures evidence (screenshots / console / errors), and returns a structured
   PASS / FAIL / WARN verdict per flow, catching UX / visual / logic regressions that
   scripted tests miss.

This is a **hybrid**: scripted smoke for stable flows + AI journeys for new/risky flows.
Coverage target for v1 is **comprehensive** across all three roles.

## Why agent-browser (not "more Playwright")

- Playwright = deterministic, brittle, asserts known selectors. Good regression net.
- agent-browser = agent-driven; uses accessibility-tree snapshots with `@eN` refs,
  has a built-in `dogfood` QA skill (structured exploration + screenshots + video +
  console/error capture + report template), `batch --json` for scripted replay,
  `state save/load` for auth reuse, and natural-language judgment.
- The two are complementary: agent-browser adds **judgment and exploration**; Playwright
  keeps the **deterministic regression net**. We do not remove or replace Playwright.

## Architecture

```
Repo (committed — source of truth)
  web/qa/agent-browser/
    flows.md            Flow catalog: every flow's role, steps, smoke-asserts, verdict criteria
    smoke/*.json        One agent-browser batch file per smoke flow (deterministic)
    run-smoke.ps1       Preconditions check -> replay every smoke/*.json -> PASS/FAIL summary
    README.md           How to run both modes; env/ports/seeded accounts
    output/             gitignored — screenshots, videos, journey reports
  .claude/skills/qa-flows/
    SKILL.md            Orchestration skill (in-repo, versioned with the app)

External (installed, not in repo)
  agent-browser CLI (global), its `core` + `dogfood` skills, Chrome for Testing
```

### Components & responsibilities

- **`flows.md` (catalog, source of truth).** Human- and agent-readable. One section per
  flow. Each flow records: `id`, `role` (public/student/instructor), `route(s)`,
  ordered `steps`, `smoke-assertions` (the exact text/url checks the batch file encodes),
  and `journey-verdict criteria` (what "good" looks like for the AI verdict). Both the
  smoke batch files and the journey mode read intent from here. Changing a flow = edit
  one catalog section + its batch file.

- **`smoke/*.json` (deterministic batches).** Each is an `agent-browser batch --json`
  payload: `[["open","…"],["fill","@e..","…"],…,["wait","--text","…"]]`. The terminal
  assertion (`wait --text` / `wait --url` / `get url`) makes the batch exit non-zero on
  failure. No LLM. Auth is performed by form-fill against `/login` (or a pre-saved
  `state load`) at the top of each batch, or once via the runner.

- **`run-smoke.ps1` (runner).** (1) Verifies stack health — web `:3001`, API `:3002`,
  Postgres `:5433`; if down, instructs/optionally runs `dev.ps1` + `npm run seed`.
  (2) Saves a fresh auth `state` per role. (3) Replays each `smoke/*.json` via
  `agent-browser batch --bail --json`, collects exit codes, prints a `PASS/FAIL` table,
  exits non-zero if any flow failed. PowerShell is source of truth (Windows-first).

- **`.claude/skills/qa-flows/SKILL.md` (orchestration skill).** Invoked as `/qa-flows`.
  Modes:
  - **smoke** — run `run-smoke.ps1`, report the table.
  - **journey** — for each flow in the catalog: authenticate (seeded account / saved
    state), walk the steps via `agent-browser` (snapshot → act → screenshot → `errors`/
    `console`), evaluate against the catalog's verdict criteria, emit
    `PASS / FAIL / WARN` + summary + evidence paths. Leans on `agent-browser skills get
    dogfood` for the exploration/reporting method.
  - Default (no arg): smoke first; offer journey for anything that warrants judgment.
  The skill also encodes preconditions, ports, seeded accounts, and output locations so
  any future session can run it without rediscovery.

## Auth & test data

- Seeded accounts (password `test1234`), created idempotently by `platform/prisma/seed.ts`:
  - `student@bootcamp.dev` (role student)
  - `instructor@bootcamp.dev` (role instructor)
  - `admin@bootcamp.dev` (role admin)
- Login = standard form POST to `${NEXT_PUBLIC_API_BASE}/api/auth/login`; tests/journeys
  fill the `/login` form. `/login` also exposes dev quick-test Student/Instructor buttons.
- `seed.ts` resets the test student's `Attempt` / `ExerciseResult` / `LessonAssignment`
  rows, so submission flows are re-runnable. The harness assumes a fresh seed for any
  flow that mutates student progress.
- Per-role auth is captured once with `agent-browser state save` and reused via
  `state load` to keep journeys fast.

## Ports & startup (Windows-first)

- Web dev: `:3001` (`npm run dev -p 3001`)
- Platform API: `:3002` (`:3000` is squatted by TileWebApp — see project memory)
- Postgres: `:5433` (docker compose in `platform/`)
- LSP: `:4500`
- Start everything: `.\dev.ps1` (Docker up → seed → API → web). `web/.env.local` wires
  `NEXT_PUBLIC_API_BASE=http://localhost:3002`.

## Flow catalog v1 (comprehensive)

**Public / auth**
- `auth-login` — valid login → lands off `/login`.
- `auth-login-invalid` — bad creds → error shown, stays on `/login`.
- `auth-register` — create account → success path.
- `auth-logout` — signed-in → sign out → `/login`.
- `route-guard` — unauthenticated `/dashboard` → redirect `/login`.

**Student**
- `student-dashboard` — daily strip, paths, mini-leaderboard render; no console errors.
- `student-tracks` — skill tree renders; open a track.
- `student-lesson-mc` — lesson player, multiple_choice exercise: answer → correct state.
- `student-lesson-fill` — fill_blank exercise.
- `student-lesson-predict` — predict_output exercise.
- `student-lesson-code` — code exercise: edit Monaco → submit → result.
- `student-review` — AI review queue renders / completes a due item.
- `student-feedback` — submit per-lesson feedback; appears in history.
- `student-leaderboard` — weekly/monthly/all-time toggle changes ranking.
- `student-badges` — earned/locked badges render.
- `student-profile` — profile renders with KPI.

**Instructor**
- `instructor-dashboard` — pending + reviewed submission queues render.
- `instructor-students` — roster tabs; open a student.
- `instructor-student-detail` — KPI cards; difficulty baseline + language controls.
- `instructor-builder` — New lesson → immersive editor opens.
- `instructor-review` — open a submission review (code + output) for an attempt.
- `instructor-ratings` — load ratings by attemptId.
- `instructor-badges` — create a badge → appears in list.
- `instructor-skill-tree` — composer: cohort picker → custom-exercise rules.
- `instructor-assign-tree` — **current branch flow**: assign a skill tree to one student
  from the composer (the feature on `feat/assign-tree-to-student-from-composer`).

> Smoke batches will be authored for the stable, deterministic subset (auth, dashboard,
> lesson-mc, leaderboard toggle, instructor roster/detail, assign-tree). The remaining
> flows are covered by journey mode where judgment matters more than fixed selectors.
> The catalog marks each flow `smoke`, `journey`, or `both`.

## Error handling & failure modes

- **Stack down:** runner/skill detects no listener on `:3001`/`:3002` and stops with a
  clear "run `dev.ps1` first" message (or runs it, behind a confirm in the skill).
- **Stale data:** flows that mutate progress require a fresh `npm run seed`; the skill
  re-seeds before destructive student journeys.
- **Chrome missing:** `agent-browser install` is a one-time precondition; runner checks
  and instructs.
- **Flaky AI verdict:** journey mode always attaches evidence (screenshots + console) so
  a human can adjudicate; `WARN` is used for ambiguous/uncertain findings rather than a
  hard FAIL.
- **Port drift:** ports are read from one place (skill/README constants) so a change is
  a single edit.

## Out of scope (v1 / YAGNI)

- CI integration / scheduled runs (manual invocation only for v1).
- Production-target journeys (prod smoke already exists in Playwright; AI journeys stay
  on local to avoid writing to prod DB — see `AI_REVIEW_ENABLED=false` prod policy).
- Visual-diff / pixel regression.
- Auto-filing tickets from findings (could later feed the `open-ticket` skill).

## Testing the harness itself

- `run-smoke.ps1` is validated by running it against a live local stack and confirming
  the PASS table + correct non-zero exit when a flow is deliberately broken.
- The skill is validated by running one smoke flow and one journey flow end-to-end and
  confirming evidence + verdict are produced (per the global "verification is mandatory"
  rule).
