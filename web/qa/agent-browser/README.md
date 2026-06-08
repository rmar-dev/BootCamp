# agent-browser QA Harness

AI-driven browser QA for the BootCamp web app, complementing the Playwright e2e suite.
Two modes: **smoke** (deterministic batch replay) and **journey** (AI exploratory + verdict).

Driven by the [`agent-browser`](https://github.com/vercel-labs/agent-browser) CLI.

## Prerequisites
- `npm i -g agent-browser && agent-browser install` (Chrome for Testing, one-time).
- Local stack running: Postgres `:5433`, API `:3002`, web `:3001`.
  - `..\..\..\dev.ps1` starts everything **but only parses under PowerShell 7** (the file
    is UTF-8 with em-dashes; Windows PowerShell 5.1 mis-reads it). Under 5.1, start the
    pieces manually:
    ```powershell
    cd platform; docker compose up -d; npm run seed
    # API (new window):  $env:PORT='3002'; $env:WEB_ORIGIN='http://localhost:3001'; npm run start
    # web (new window):  $env:NEXT_PUBLIC_API_BASE='http://localhost:3002'; npx next dev -p 3001
    ```
- **Always `npm run seed` in `platform/` right before a run.** The seed `upsert` only
  *creates* users (`update: {}`), so if the test users are absent — e.g. another process
  reset the dev DB — login returns 401 until you re-seed. Seed also resets the test
  student's attempts so progress-mutating flows are re-runnable.
  > Note: the dev DB on `:5433` is shared. If a concurrent session runs the platform
  > Jest suite against it, the `User` table gets truncated mid-run. For reliable runs,
  > point this stack at a dedicated DB.

## Seeded accounts (password `test1234`)
- `student@bootcamp.dev` · `instructor@bootcamp.dev` · `admin@bootcamp.dev`

## Smoke mode (deterministic, no LLM)
```powershell
npm run seed   # in platform/, immediately before the run
.\run-smoke.ps1                                  # all flows
.\run-smoke.ps1 -Only auth-login,student-dashboard
```
Prints a PASS/FAIL table; exits non-zero if any flow fails. Screenshots land in `output/`.

### Windows stdin note
`agent-browser` reads each batch's JSON from stdin. PowerShell 5.1 cannot pipe stdin into
the npm `.cmd` shim reliably (it hangs), and calling the shim via `&` can stall on an
inherited stdin handle — so `run-smoke.ps1` runs every agent-browser call through
`cmd /c "<shim> ... < file.json"`. From Git-Bash you can instead use
`agent-browser ... batch --bail < file.json` directly.

### Assertion style
Batches assert with: trigger → `wait <ms>` → `eval` (returns truthy or `throw`s). Avoid
`wait --url` / `wait --fn` across a navigation — they intermittently throw a CDP
`os error 10060` while the page is navigating.

## Journey mode (AI exploratory + verdict)
Invoke the `/qa-flows` skill (`.claude/skills/qa-flows/`) in a Claude Code session:
```
/qa-flows journey instructor-assign-tree
/qa-flows journey            # all journey-mode flows
```
The skill authenticates, walks each flow per `flows.md`, captures screenshots + console/
errors into `output/`, and returns PASS / WARN / FAIL with evidence paths.

## Catalog
`flows.md` is the source of truth. Each flow is `smoke`, `journey`, or `both`.
Adding a flow = add a catalog section (+ a `smoke/<id>.json` if deterministic). Discover
selectors live from `agent-browser snapshot -i` — never invent them. Prefer semantic
locators (`find label …`, `find role … --name …`) over `@eN` refs in committed batches.

## Output
`output/` is gitignored. Contains screenshots, videos, journey reports, saved auth state.

## Status (v1)
- Smoke batches authored: auth-login, auth-login-invalid, auth-logout, route-guard
  (auth/guard set). `auth-login` validated end-to-end (lands on `/tracks`).
- Student/instructor smoke batches: catalogued in `flows.md`; batch files are follow-up.
- Journey mode + full catalog cover student/instructor flows via the skill.
