---
name: qa-flows
description: Run the BootCamp agent-browser QA harness — deterministic smoke batches and/or AI exploratory journeys across student/instructor/public flows, with screenshot + console evidence and a PASS/FAIL/WARN verdict per flow. Use when asked to QA, smoke-test, dogfood, or verify BootCamp web flows end-to-end against the local stack. Triggers include "/qa-flows", "smoke test the app", "QA the instructor flows", "journey test login".
---

# qa-flows — BootCamp agent-browser QA

Drives the `agent-browser` CLI against the local BootCamp web app. Two modes:
**smoke** (deterministic batch replay) and **journey** (AI exploration + verdict).

- Catalog (source of truth): `web/qa/agent-browser/flows.md`
- Harness assets: `web/qa/agent-browser/` (`smoke/*.json`, `run-smoke.ps1`, `output/`)

## Constants
- Base URL `http://localhost:3001` · API `:3002` · Postgres `:5433`.
- Seeded accounts (password `test1234`): `student@bootcamp.dev`, `instructor@bootcamp.dev`, `admin@bootcamp.dev`.
- Seeded lesson id `22222222-2222-4222-8222-222222222222`; seeded student id `99999999-9999-4999-8999-999999999999`.
- agent-browser binary may need PATH on Git-Bash: `export PATH="$PATH:/c/Users/ricma/AppData/Roaming/npm"`.
- Always use `agent-browser` directly, never `npx agent-browser` (npx is much slower).
- First `agent-browser open` of a session launches Chrome and can take 20–60s — be patient / poll.

## Authoring batches — gotchas learned the hard way
- **stdin on Windows:** piping JSON into the npm `.cmd` shim from PowerShell hangs.
  Feed it via `cmd /c "<shim> batch --bail < file.json"` (what `run-smoke.ps1` does),
  or from Git-Bash use `agent-browser ... batch --bail < file.json`.
- **`batch` flags:** there is no `--stdin`; stdin JSON is auto-detected. `--json` only
  changes *output* format. Use `--bail` so the first failed command sets a non-zero exit.
- **Avoid `wait --url` / `wait --fn` across a navigation** — they intermittently throw a
  CDP `os error 10060` while the page is navigating. Instead: trigger the action →
  `wait <ms>` (a fixed pause) → assert with a single `eval` that returns truthy or
  `throw`s. A thrown `eval` fails the command (→ non-zero exit under `--bail`).
- **Login locators (confirmed):** textbox "Email", textbox "Password", button "Sign in".
  The dev login page pre-fills `student@bootcamp.dev` / `test1234`.

## Preconditions (run first, every mode)
1. Stack up: web `:3001` and API `:3002` listening
   (`Test-NetConnection 127.0.0.1 -Port 3001`). If down, start it. Under Windows
   PowerShell 5.1 `dev.ps1` may fail to parse (UTF-8/em-dash vs CP1252); if so start the
   pieces manually: `docker compose up -d` + `npm run seed` in `platform/`, then launch
   the Nest API (`PORT=3002 WEB_ORIGIN=http://localhost:3001 npm run start`) and Next web
   (`NEXT_PUBLIC_API_BASE=http://localhost:3002 npx next dev -p 3001`).
2. **Always `npm run seed` in `platform/` before a run.** The seed `upsert` only creates
   users; if the test users are absent (DB reset) login returns 401 until re-seeded. Seed
   also resets the test student's attempts so progress-mutating flows are re-runnable.
3. agent-browser + Chrome installed (`agent-browser --version`; if Chrome missing,
   `agent-browser install`).

## Mode: smoke
Deterministic, no judgment. Run the runner and report its table.
```powershell
powershell -File web/qa/agent-browser/run-smoke.ps1            # all
powershell -File web/qa/agent-browser/run-smoke.ps1 -Only auth-login,student-dashboard
```
Report the PASS/FAIL table verbatim and the exit code. Non-zero exit = failures; attach
the relevant `output/<flow>.png` for any FAIL.

## Mode: journey
AI exploratory pass per flow. Lean on agent-browser's own QA method:
`agent-browser skills get dogfood` (structured explore + screenshot + console/error + report).

For each requested flow (from `flows.md`; default = all `mode: journey` or `both`):
1. **Authenticate** for the flow's role. Reuse a saved state if present
   (`output/<role>.state.json` via `state load`); else form-login on `/login` with the
   seeded account and `state save` it.
2. **Walk the steps** from the catalog: at each meaningful step
   `snapshot -i` → act (`find …` / `click @eN`) → `screenshot --annotate output/journey-<flow>-<step>.png`.
3. **Capture health:** `agent-browser --session <s> errors` and `… console` after key actions.
4. **Evaluate against the catalog `verdict` criteria:**
   - **PASS** — all verdict criteria met, no console errors on core actions.
   - **WARN** — works but with a UX/cosmetic issue, or an ambiguous/uncertain finding.
   - **FAIL** — a verdict criterion unmet, a crash, or console errors on a core action.
5. **Record evidence:** for any WARN/FAIL save a screenshot (and a `record start/stop`
   video for interactive bugs) and note exact repro steps.

## Verdict report format (per flow)
```
### <flow-id> — PASS | WARN | FAIL
- Role: <student|instructor|public>
- What I did: <one line>
- Result: <one line>
- Console errors: <none | list>
- Evidence: output/journey-<flow>-*.png  (+ video if any)
- Notes: <UX issues, follow-ups>
```
End with: `journey: X PASS / Y WARN / Z FAIL across N flows`.
For real bugs, offer to file via the `open-ticket` skill (do not auto-file).

## Default (no args)
Run **smoke** first (fast regression signal); then offer **journey** for new/risky flows
or anything that FAILED smoke.

## Adding coverage
Edit `web/qa/agent-browser/flows.md` (catalog). If the flow is deterministic, add a
`web/qa/agent-browser/smoke/<id>.json` batch and validate with `run-smoke.ps1 -Only <id>`.
Discover selectors live from `snapshot -i` — never invent them. Prefer semantic locators
(`find label …`, `find role … --name …`) over `@eN` refs in committed batches.
