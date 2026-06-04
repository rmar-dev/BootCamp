# agent-browser QA Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid QA automation layer for the BootCamp web app driven by the `agent-browser` CLI — deterministic smoke batches plus AI exploratory journeys — complementing the existing Playwright e2e suite.

**Architecture:** Repo-versioned assets under `web/qa/agent-browser/` (a `flows.md` catalog as source of truth, `smoke/*.json` batch files, a `run-smoke.ps1` runner, a gitignored `output/`) plus an in-repo orchestration skill at `.claude/skills/qa-flows/SKILL.md` exposing `/qa-flows` with `smoke` and `journey` modes. Selectors are discovered live from accessibility snapshots, never hand-fabricated.

**Tech Stack:** `agent-browser` v0.27.0 (global Rust CLI), Chrome for Testing, PowerShell (Windows-first runner), the existing NestJS+Next.js BootCamp stack (web `:3001`, API `:3002`, Postgres `:5433`), seeded accounts from `platform/prisma/seed.ts`.

---

## Conventions used throughout this plan

- **Verification ≠ unit test.** "Make it fail then pass" means: run the batch/runner against the live local stack and observe the documented exit code / output. There are no Jest/Vitest tests for this harness.
- **Selector discovery is mandatory.** Before encoding any click/fill into a batch, run `agent-browser snapshot -i` (or `screenshot --annotate`) on the live page and copy the real `@eN` ref or confirm the semantic locator (`find role|text|label|testid …`). Do not guess selectors. Prefer **semantic locators** (`find label "Email" fill …`, `find role button click --name "Sign in"`) over `@eN` refs in committed batch files, because `@eN` refs are snapshot-relative and go stale; semantic locators survive DOM churn.
- **Direct binary, never npx.** Always `agent-browser …`, never `npx agent-browser …` (npx routes through Node and is much slower).
- **PATH note (Windows/Git-Bash):** the global binary is at `C:\Users\ricma\AppData\Roaming\npm`. If `agent-browser` is not found in a Bash tool call, prefix once: `export PATH="$PATH:/c/Users/ricma/AppData/Roaming/npm"`.
- **Stack must be up.** Tasks that hit the app require `.\dev.ps1` to have been run (Docker → seed → API `:3002` → web `:3001`). Tasks 0–2 and 8 (catalog/runner/skill authoring) do not strictly need a live stack until their validation step.
- **Commit cadence:** one commit per task (or per logical sub-step where noted). All commits end with the Co-Authored-By trailer used in this repo.

---

## File Structure (locked decomposition)

```
web/qa/agent-browser/
  README.md           # how to run both modes; ports; seeded accounts; output location
  flows.md            # CATALOG — source of truth; one section per flow
  run-smoke.ps1       # preconditions + auth-state + replay all smoke/*.json + PASS/FAIL table
  smoke/
    _auth-student.json    # (optional helper) form-login as student, then state save
    auth-login.json
    auth-login-invalid.json
    auth-logout.json
    route-guard.json
    student-dashboard.json
    student-lesson-mc.json
    student-leaderboard.json
    student-feedback.json
    instructor-dashboard.json
    instructor-students.json
    instructor-student-detail.json
    instructor-badges.json
    instructor-assign-tree.json
  output/             # gitignored — screenshots, videos, journey reports, *.state.json
    .gitkeep
.claude/skills/qa-flows/
  SKILL.md            # /qa-flows orchestration: smoke + journey modes
web/.gitignore        # add: qa/agent-browser/output/ (except .gitkeep)
```

Flows not given a `smoke/*.json` above (e.g. `auth-register`, the fill/predict/code lesson variants, `student-tracks`, `student-review`, `student-badges`, `student-profile`, `instructor-students` deep paths, `instructor-builder`, `instructor-review`, `instructor-ratings`, `instructor-skill-tree`) are **journey-mode** flows: covered by the AI walkthrough in the skill, catalogued in `flows.md`, but not encoded as deterministic batches in v1 (judgment matters more than fixed selectors there).

---

## Task 0: Scaffolding & preconditions

**Files:**
- Create: `web/qa/agent-browser/output/.gitkeep`
- Modify: `web/.gitignore` (create if absent)

- [ ] **Step 1: Verify agent-browser + Chrome are installed**

Run:
```bash
export PATH="$PATH:/c/Users/ricma/AppData/Roaming/npm"
agent-browser --version
agent-browser skills get core | head -40
```
Expected: prints `agent-browser 0.27.0` and the core usage guide. If Chrome is missing, a later `open` will tell you to run `agent-browser install` — run it once then.

- [ ] **Step 2: Create the output dir with a keep file**

Create `web/qa/agent-browser/output/.gitkeep` (empty file).

- [ ] **Step 3: Gitignore the output dir**

Add to `web/.gitignore` (create the file if it does not exist):
```gitignore
# agent-browser QA harness — generated evidence, never commit
qa/agent-browser/output/*
!qa/agent-browser/output/.gitkeep
```

- [ ] **Step 4: Verify the ignore works**

Run:
```bash
cd /c/Users/ricma/BootCamp/web && printf 'x' > qa/agent-browser/output/scratch.png && git status --porcelain qa/agent-browser/output/
```
Expected: only `.gitkeep` shows as untracked (once added); `scratch.png` does NOT appear. Then `rm qa/agent-browser/output/scratch.png`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/.gitignore web/qa/agent-browser/output/.gitkeep && \
git commit -m "chore(qa): scaffold agent-browser harness output dir + gitignore"
```

---

## Task 1: Author the flow catalog (`flows.md`)

This is the source of truth. It has no live dependency, so write it in full now. Each flow block uses this exact shape so both the runner author and journey mode can read intent uniformly.

**Files:**
- Create: `web/qa/agent-browser/flows.md`

- [ ] **Step 1: Write the catalog**

Create `web/qa/agent-browser/flows.md` with this content:

````markdown
# BootCamp Flow Catalog

Source of truth for the agent-browser QA harness. Every flow has:
`id`, `role`, `mode` (smoke | journey | both), `route(s)`, `steps`,
`smoke-assert` (exact check the batch encodes — only for smoke/both),
`verdict` (what "good" means for journey mode).

Seeded accounts (password `test1234`): `student@bootcamp.dev`,
`instructor@bootcamp.dev`, `admin@bootcamp.dev`.
Ports: web `:3001`, API `:3002`, Postgres `:5433`. Base URL `http://localhost:3001`.

---

## Public / auth

### auth-login  ·  role: public  ·  mode: both
- route: `/login`
- steps: open `/login` → fill Email `student@bootcamp.dev` → fill Password `test1234` → click "Sign in" → wait for URL to leave `/login`.
- smoke-assert: URL no longer starts with `/login` (lands on `/tracks` or `/dashboard`).
- verdict: lands on an authed page; sidebar visible; no console errors.

### auth-login-invalid  ·  role: public  ·  mode: both
- route: `/login`
- steps: open `/login` → fill Email `student@bootcamp.dev` → fill Password `wrongpass` → click "Sign in".
- smoke-assert: an error message is visible AND URL still starts with `/login`.
- verdict: clear inline error; no crash; user stays on login.

### auth-register  ·  role: public  ·  mode: journey
- route: `/register`
- steps: open `/register` → fill email/name/password with a fresh unique email → submit.
- verdict: account created and signed in, OR a clear validation message for duplicates; no crash.

### auth-logout  ·  role: student  ·  mode: both
- route: any authed → sign out
- steps: login as student → open settings/user menu → click Sign out.
- smoke-assert: URL returns to `/login`.
- verdict: session cleared; protected routes redirect afterward.

### route-guard  ·  role: public  ·  mode: both
- route: `/dashboard` (unauthenticated)
- steps: ensure logged out → open `/dashboard`.
- smoke-assert: URL redirects to `/login`.
- verdict: no protected content flashes before redirect.

---

## Student

### student-dashboard  ·  role: student  ·  mode: both
- route: `/dashboard`
- steps: login student → open `/dashboard`.
- smoke-assert: "Welcome back" heading visible AND a leaderboard heading visible.
- verdict: daily strip, paths, mini-leaderboard, streak/points render; no console errors.

### student-tracks  ·  role: student  ·  mode: journey
- route: `/tracks`
- verdict: skill tree renders grouped lessons; opening a track works.

### student-lesson-mc  ·  role: student  ·  mode: both
- route: `/lesson/22222222-2222-4222-8222-222222222222`
- steps: login student → open the seeded lesson → navigate to the multiple_choice block → select the correct option → submit.
- smoke-assert: a correct/success state is shown for the MC exercise.
- verdict: correct answer accepted; locked/next state appears; reset available.
- note: requires fresh `npm run seed` (progress is reset there).

### student-lesson-fill / -predict / -code  ·  role: student  ·  mode: journey
- route: same seeded lesson, other blocks
- verdict: each exercise type accepts a correct answer and shows result; Monaco loads for code.

### student-review  ·  role: student  ·  mode: journey
- route: `/review`
- verdict: due AI reviews render; completing one advances the queue.

### student-feedback  ·  role: student  ·  mode: both
- route: `/feedback`
- steps: login student → open `/feedback` → fill the comment textarea → submit.
- smoke-assert: the submitted feedback appears in the history list below.
- verdict: submission persists and shows in history; no crash.

### student-leaderboard  ·  role: student  ·  mode: both
- route: `/leaderboard`
- steps: login student → open `/leaderboard` → toggle weekly → monthly → all-time.
- smoke-assert: the page shows a leaderboard heading and the period toggle is present after switching.
- verdict: each period renders a ranking without error.

### student-badges  ·  role: student  ·  mode: journey
- route: `/badges`
- verdict: earned/locked badges render with icons + descriptions.

### student-profile  ·  role: student  ·  mode: journey
- route: `/profile`
- verdict: profile + KPI render; instructor-authored badges show if present.

---

## Instructor

### instructor-dashboard  ·  role: instructor  ·  mode: both
- route: `/instructor`
- steps: login instructor → open `/instructor`.
- smoke-assert: a pending-submissions queue and a reviewed queue are present.
- verdict: both queues render; counts plausible; no console errors.

### instructor-students  ·  role: instructor  ·  mode: both
- route: `/instructor/students`
- steps: login instructor → open `/instructor/students`.
- smoke-assert: the roster shows an "Assigned" tab and at least one student row/link.
- verdict: tabs switch; student rows link to detail.

### instructor-student-detail  ·  role: instructor  ·  mode: both
- route: `/instructor/students/<id>`
- steps: login instructor → open roster → open the seeded student → read KPI cards + difficulty/language controls.
- smoke-assert: difficulty baseline controls (easy/standard/challenging) and language controls (Swift/Kotlin/Any) are present.
- verdict: KPI cards render; controls reflect current state; changing a control persists.

### instructor-builder  ·  role: instructor  ·  mode: journey
- route: `/instructor/builder`
- verdict: "New lesson" opens the immersive editor; Monaco loads.

### instructor-review  ·  role: instructor  ·  mode: journey
- route: `/instructor/review/<attemptId>`
- verdict: a submission's code + test output render; a grade/feedback can be assigned.

### instructor-ratings  ·  role: instructor  ·  mode: journey
- route: `/instructor/ratings`
- verdict: entering an attemptId loads its ratings.

### instructor-badges  ·  role: instructor  ·  mode: both
- route: `/instructor/badges`
- steps: login instructor → open `/instructor/badges` → fill Name → create badge.
- smoke-assert: the new badge name appears in the badge list after creation.
- verdict: badge persists in the instructor-authored list; system badges still shown.
- note: creating duplicate-named badges across runs is acceptable; assertion checks presence of the name, not uniqueness.

### instructor-skill-tree  ·  role: instructor  ·  mode: journey
- route: `/instructor/skill-tree`
- verdict: cohort picker drives per-cohort custom-exercise rules.

### instructor-assign-tree  ·  role: instructor  ·  mode: both  ·  CURRENT BRANCH FEATURE
- route: `/instructor/skill-tree` (composer)
- steps: login instructor → open the skill-tree composer → assign a tree to one student via the composer's assign control → confirm.
- smoke-assert: a success/confirmation state for the assignment is shown.
- verdict: the tree is assigned to exactly the chosen student; dropdown labels are clear (the feature on `feat/assign-tree-to-student-from-composer`).
````

- [ ] **Step 2: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/flows.md && \
git commit -m "docs(qa): add agent-browser flow catalog (source of truth)"
```

---

## Task 2: Auth helper batch + the smoke runner (`run-smoke.ps1`)

Build the runner before any page batch, so each subsequent batch is validated by replaying it through the runner exactly as CI/dev would.

**Files:**
- Create: `web/qa/agent-browser/smoke/_auth-student.json`
- Create: `web/qa/agent-browser/run-smoke.ps1`

- [ ] **Step 1: Bring the stack up and confirm health**

Run (PowerShell):
```powershell
cd C:\Users\ricma\BootCamp ; .\dev.ps1
```
Then confirm listeners:
```powershell
(Test-NetConnection 127.0.0.1 -Port 3001).TcpTestSucceeded
(Test-NetConnection 127.0.0.1 -Port 3002).TcpTestSucceeded
```
Expected: both `True`. (Leave the two app windows running.)

- [ ] **Step 2: Discover the login locators live, then write the auth helper batch**

Discover:
```bash
export PATH="$PATH:/c/Users/ricma/AppData/Roaming/npm"
agent-browser --session bc-disc open http://localhost:3001/login
agent-browser --session bc-disc wait --load networkidle
agent-browser --session bc-disc snapshot -i
```
Confirm from the snapshot the accessible names for the Email field, Password field, and the "Sign in" button (the Playwright suite uses `label /email/i`, `label /password/i`, role button `/^sign in$/i`). Then close: `agent-browser --session bc-disc close`.

Create `web/qa/agent-browser/smoke/_auth-student.json` (semantic locators; adjust the three strings only if the snapshot shows different accessible names):
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--url", "**/tracks"]
]
```
If post-login lands on `/dashboard` instead of `/tracks`, change the final wait to `["wait","--fn","!location.pathname.startsWith('/login')"]` (robust to either landing page).

- [ ] **Step 3: Validate the auth batch in isolation**

Run:
```bash
agent-browser --session bc-auth batch --bail --json < /c/Users/ricma/BootCamp/web/qa/agent-browser/smoke/_auth-student.json ; echo "exit=$?"
agent-browser --session bc-auth get url
agent-browser --session bc-auth state save /c/Users/ricma/BootCamp/web/qa/agent-browser/output/student.state.json
agent-browser --session bc-auth close
```
Expected: `exit=0`, `get url` prints an authed path (not `/login`), and a `student.state.json` is written. If it fails, fix the locator strings (do NOT proceed until exit=0).

- [ ] **Step 4: Write the runner**

Create `web/qa/agent-browser/run-smoke.ps1`:
```powershell
#Requires -Version 5.1
<#
  run-smoke.ps1 — replay every smoke/*.json agent-browser batch against the
  local BootCamp stack and print a PASS/FAIL table. Exits non-zero if any fail.

  Usage:
    .\run-smoke.ps1                 # all smoke flows
    .\run-smoke.ps1 -Only auth-login,student-dashboard
    .\run-smoke.ps1 -WebPort 3001 -ApiPort 3002
#>
param(
  [string[]] $Only,
  [int] $WebPort = 3001,
  [int] $ApiPort = 3002
)
$ErrorActionPreference = 'Stop'
$root   = $PSScriptRoot
$smoke  = Join-Path $root 'smoke'
$output = Join-Path $root 'output'
$ab     = 'agent-browser'

# --- locate agent-browser ---
if (-not (Get-Command $ab -ErrorAction SilentlyContinue)) {
  $npmDir = Join-Path $env:APPDATA 'npm'
  if (Test-Path (Join-Path $npmDir 'agent-browser.cmd')) { $ab = Join-Path $npmDir 'agent-browser.cmd' }
  else { Write-Error "agent-browser not found on PATH. Install: npm i -g agent-browser; agent-browser install"; exit 2 }
}

# --- preconditions: stack must be up ---
function Test-Port([int]$p) { (Test-NetConnection 127.0.0.1 -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
if (-not (Test-Port $WebPort)) { Write-Error "Web not listening on :$WebPort. Run .\dev.ps1 first."; exit 2 }
if (-not (Test-Port $ApiPort)) { Write-Error "API not listening on :$ApiPort. Run .\dev.ps1 first."; exit 2 }

# --- select batch files (exclude helpers starting with _) ---
$files = Get-ChildItem -Path $smoke -Filter '*.json' | Where-Object { $_.Name -notlike '_*' }
if ($Only) { $files = $files | Where-Object { $Only -contains $_.BaseName } }
if (-not $files) { Write-Error "No smoke batch files matched."; exit 2 }

$results = @()
foreach ($f in $files) {
  $name = $f.BaseName
  Write-Host "▶ $name" -ForegroundColor Cyan
  $session = "bc-smoke-$name"
  & $ab --session $session batch --bail --json --stdin < $f.FullName | Out-Host
  $code = $LASTEXITCODE
  & $ab --session $session screenshot (Join-Path $output "$name.png") | Out-Null
  & $ab --session $session close | Out-Null
  $results += [pscustomobject]@{ Flow = $name; Status = (if ($code -eq 0) { 'PASS' } else { 'FAIL' }); Exit = $code }
}

Write-Host "`n==== SMOKE RESULTS ====" -ForegroundColor White
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { $_.Status -ne 'PASS' })
Write-Host ("{0}/{1} passed" -f ($results.Count - $failed.Count), $results.Count)
if ($failed.Count -gt 0) { exit 1 } else { exit 0 }
```

> Note: agent-browser reads piped JSON with `batch --json --stdin`. If your installed
> version expects `batch --json` to auto-read stdin (no `--stdin`), drop the `--stdin`
> token — confirm with `agent-browser batch --help` during Step 5.

- [ ] **Step 5: Confirm the runner's batch invocation matches the CLI**

Run:
```bash
agent-browser batch --help 2>&1 | head -30
```
Adjust the `& $ab … batch …` line in `run-smoke.ps1` to match the exact stdin flag the help shows. (This is the one place the CLI surface must be confirmed, not assumed.)

- [ ] **Step 6: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/run-smoke.ps1 web/qa/agent-browser/smoke/_auth-student.json && \
git commit -m "feat(qa): add smoke runner + student auth helper batch"
```

---

## Task 3: Auth + guard smoke batches

Each batch is authored by discovering locators live, then validated through the runner.

**Files:**
- Create: `web/qa/agent-browser/smoke/auth-login.json`
- Create: `web/qa/agent-browser/smoke/auth-login-invalid.json`
- Create: `web/qa/agent-browser/smoke/auth-logout.json`
- Create: `web/qa/agent-browser/smoke/route-guard.json`

- [ ] **Step 1: `auth-login.json`** — same shape as `_auth-student.json` but standalone and assertion-terminated:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"]
]
```

- [ ] **Step 2: `auth-login-invalid.json`** — discover the error element's text on the live page first (`snapshot -i` after a bad submit), then encode a `wait --text` for the real message:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "wrongpass"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--text", "REPLACE_WITH_REAL_ERROR_SUBSTRING"],
  ["eval", "if(location.pathname.startsWith('/login')) true; else throw new Error('left login on bad creds')"]
]
```
Replace `REPLACE_WITH_REAL_ERROR_SUBSTRING` with the actual error copy observed (e.g. a substring of the invalid-credentials message). The trailing `eval` throws (non-zero exit) if the app wrongly navigated away.

- [ ] **Step 3: `auth-logout.json`** — discover the user/settings menu + "Sign out" control live (the shell has a settings menu per the route map), then encode:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["click", "REPLACE_WITH_SETTINGS_MENU_SELECTOR"],
  ["find", "text", "Sign out", "click"],
  ["wait", "--url", "**/login"]
]
```
Replace the settings-menu selector with the real ref/locator from the snapshot (it may be an icon button; use `find role button --name "…"` or a `@eN` ref captured at author time and immediately replaced with a stable locator).

- [ ] **Step 4: `route-guard.json`** — must start unauthenticated. Use a clean session that loads no saved state:
```json
[
  ["open", "http://localhost:3001/dashboard"],
  ["wait", "--url", "**/login"]
]
```

- [ ] **Step 5: Validate all four through the runner**

Run (PowerShell):
```powershell
cd C:\Users\ricma\BootCamp\web\qa\agent-browser
.\run-smoke.ps1 -Only auth-login,auth-login-invalid,auth-logout,route-guard
```
Expected: a 4-row table, all `PASS`, "4/4 passed", exit 0. Iterate on any `FAIL` by re-snapshotting the offending page and fixing the locator/assert. Do not commit until 4/4.

- [ ] **Step 6: Negative control (prove the harness can fail)**

Temporarily edit `auth-login.json`'s email to `nobody@bootcamp.dev`, re-run `-Only auth-login`, and confirm it reports `FAIL` / exit 1. Then revert the email. This proves the runner does not false-pass.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/smoke/auth-login.json web/qa/agent-browser/smoke/auth-login-invalid.json web/qa/agent-browser/smoke/auth-logout.json web/qa/agent-browser/smoke/route-guard.json && \
git commit -m "feat(qa): add auth + route-guard smoke batches"
```

---

## Task 4: Student smoke batches

**Files:**
- Create: `web/qa/agent-browser/smoke/student-dashboard.json`
- Create: `web/qa/agent-browser/smoke/student-lesson-mc.json`
- Create: `web/qa/agent-browser/smoke/student-leaderboard.json`
- Create: `web/qa/agent-browser/smoke/student-feedback.json`

For every batch below: log in inline (the auth prefix), then act. Discover each page's real locators/assertion text live before encoding.

- [ ] **Step 1: `student-dashboard.json`**
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/dashboard"],
  ["wait", "--load", "networkidle"],
  ["wait", "--text", "Welcome back"],
  ["eval", "if(/leaderboard/i.test(document.body.innerText)) true; else throw new Error('no leaderboard heading on dashboard')"]
]
```
(Confirm "Welcome back" copy from the live page; the route map cites an `h1 /welcome back/i`.)

- [ ] **Step 2: `student-lesson-mc.json`** — open the seeded lesson, reach the MC block, answer correctly. Discover the MC option + submit control live; the seeded lesson's correct answers are fixed in `seed.ts`.
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/lesson/22222222-2222-4222-8222-222222222222"],
  ["wait", "--load", "networkidle"],
  ["__DISCOVER__", "navigate to the multiple_choice block (step param or Next), select the correct option, click submit"],
  ["wait", "--text", "REPLACE_WITH_CORRECT_STATE_TEXT"]
]
```
Replace the `__DISCOVER__` placeholder line with the real ordered commands found via snapshot (e.g. `["open",".../lesson/…?step=N"]`, `["find","role","radio","click","--name","…"]`, `["find","role","button","click","--name","Submit"]`), and the assert with the real success copy. **This is the most involved batch — budget the most discovery time here. Requires `npm run seed` immediately before running** (resets the student's attempt history so the MC is re-submittable).

- [ ] **Step 3: `student-leaderboard.json`** — toggle the three periods, assert the heading + a period control survive the switch:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/leaderboard?period=weekly"],
  ["wait", "--load", "networkidle"],
  ["open", "http://localhost:3001/leaderboard?period=monthly"],
  ["wait", "--load", "networkidle"],
  ["open", "http://localhost:3001/leaderboard?period=all-time"],
  ["wait", "--load", "networkidle"],
  ["eval", "if(/leaderboard/i.test(document.body.innerText)) true; else throw new Error('leaderboard heading missing')"]
]
```

- [ ] **Step 4: `student-feedback.json`** — submit a comment, assert it appears in history. Discover the textarea + submit + history-item locators live:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "student@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/feedback"],
  ["wait", "--load", "networkidle"],
  ["find", "role", "textbox", "fill", "agent-browser smoke check"],
  ["__DISCOVER__", "click the submit button (confirm its accessible name)"],
  ["wait", "--text", "agent-browser smoke check"]
]
```
Replace `__DISCOVER__` with the real submit command. The final `wait --text` confirms the comment rendered into the history list.

- [ ] **Step 5: Validate through the runner**

```powershell
cd C:\Users\ricma\BootCamp ; .\platform\... # ensure seeded:
cd C:\Users\ricma\BootCamp\platform ; npm run seed
cd C:\Users\ricma\BootCamp\web\qa\agent-browser
.\run-smoke.ps1 -Only student-dashboard,student-lesson-mc,student-leaderboard,student-feedback
```
Expected: 4/4 PASS, exit 0. Iterate on failures via re-snapshot. Do not commit until green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/smoke/student-*.json && \
git commit -m "feat(qa): add student smoke batches (dashboard, lesson-mc, leaderboard, feedback)"
```

---

## Task 5: Instructor smoke batches

**Files:**
- Create: `web/qa/agent-browser/smoke/instructor-dashboard.json`
- Create: `web/qa/agent-browser/smoke/instructor-students.json`
- Create: `web/qa/agent-browser/smoke/instructor-student-detail.json`
- Create: `web/qa/agent-browser/smoke/instructor-badges.json`
- Create: `web/qa/agent-browser/smoke/instructor-assign-tree.json`

All log in as `instructor@bootcamp.dev`. Discover locators/assert text live per page.

- [ ] **Step 1: `instructor-dashboard.json`** — assert both queues present:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "instructor@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/instructor"],
  ["wait", "--load", "networkidle"],
  ["eval", "if(/pending/i.test(document.body.innerText) && /review/i.test(document.body.innerText)) true; else throw new Error('instructor queues missing')"]
]
```
(Confirm the exact queue headings live; adjust the regex to the real copy.)

- [ ] **Step 2: `instructor-students.json`** — roster with Assigned tab + a student row:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "instructor@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/instructor/students"],
  ["wait", "--load", "networkidle"],
  ["wait", "--text", "Assigned"],
  ["eval", "if(document.querySelectorAll('a,[role=row],li').length > 0) true; else throw new Error('empty roster')"]
]
```

- [ ] **Step 3: `instructor-student-detail.json`** — open the seeded student detail; assert difficulty + language controls. The seeded student id is `99999999-9999-4999-8999-999999999999`:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "instructor@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/instructor/students/99999999-9999-4999-8999-999999999999"],
  ["wait", "--load", "networkidle"],
  ["eval", "var t=document.body.innerText; if(/swift/i.test(t) && /kotlin/i.test(t)) true; else throw new Error('language controls missing')"]
]
```
If the detail route differs (the route map cites `/instructor/students/[id]` but reached via roster click), discover the real navigation and prefer clicking the seeded student's row over a hardcoded URL if the id-route 404s.

- [ ] **Step 4: `instructor-badges.json`** — create a badge, assert it lists. Discover the Name field + "Create badge" button live:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "instructor@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/instructor/badges"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Name", "fill", "Smoke Badge"],
  ["find", "role", "button", "click", "--name", "Create badge"],
  ["wait", "--text", "Smoke Badge"]
]
```

- [ ] **Step 5: `instructor-assign-tree.json`** (current branch feature) — open the composer, assign a tree to the seeded student. This flow's exact controls live on `feat/assign-tree-to-student-from-composer`; **discover them live** (composer route + the assign control + the student dropdown + confirm), then encode:
```json
[
  ["open", "http://localhost:3001/login"],
  ["wait", "--load", "networkidle"],
  ["find", "label", "Email", "fill", "instructor@bootcamp.dev"],
  ["find", "label", "Password", "fill", "test1234"],
  ["find", "role", "button", "click", "--name", "Sign in"],
  ["wait", "--fn", "!location.pathname.startsWith('/login')"],
  ["open", "http://localhost:3001/instructor/skill-tree"],
  ["wait", "--load", "networkidle"],
  ["__DISCOVER__", "open the assign-to-student control, pick the seeded student, confirm the assignment"],
  ["wait", "--text", "REPLACE_WITH_ASSIGNMENT_SUCCESS_TEXT"]
]
```
Replace the `__DISCOVER__` line and assertion with the real composer controls/copy. Cross-check against the feature's UI on this branch (commit `cb3abfd`).

- [ ] **Step 6: Validate through the runner**

```powershell
cd C:\Users\ricma\BootCamp\web\qa\agent-browser
.\run-smoke.ps1 -Only instructor-dashboard,instructor-students,instructor-student-detail,instructor-badges,instructor-assign-tree
```
Expected: 5/5 PASS, exit 0. Iterate on failures. Do not commit until green.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/smoke/instructor-*.json && \
git commit -m "feat(qa): add instructor smoke batches incl. assign-tree-from-composer"
```

---

## Task 6: Full smoke run + README

**Files:**
- Create: `web/qa/agent-browser/README.md`

- [ ] **Step 1: Run the entire smoke suite**

```powershell
cd C:\Users\ricma\BootCamp\platform ; npm run seed
cd C:\Users\ricma\BootCamp\web\qa\agent-browser ; .\run-smoke.ps1
```
Expected: every flow `PASS`, "N/N passed", exit 0. Capture the printed table for the README and for the eventual PR evidence. If any flow flakes, stabilize its `wait`/assert (add `wait --load networkidle`, prefer `wait --text` over fixed sleeps).

- [ ] **Step 2: Write the README**

Create `web/qa/agent-browser/README.md`:
````markdown
# agent-browser QA Harness

AI-driven browser QA for the BootCamp web app, complementing the Playwright e2e suite.
Two modes: **smoke** (deterministic batch replay) and **journey** (AI exploratory + verdict).

## Prerequisites
- `npm i -g agent-browser && agent-browser install` (Chrome for Testing, one-time).
- Local stack running: `..\..\..\dev.ps1` → Docker/Postgres `:5433`, API `:3002`, web `:3001`.
- Seeded data: `npm run seed` in `platform/` (resets the test student's progress).

## Seeded accounts (password `test1234`)
- `student@bootcamp.dev` · `instructor@bootcamp.dev` · `admin@bootcamp.dev`

## Smoke mode (deterministic, no LLM)
```powershell
npm run seed   # in platform/, before progress-mutating flows
.\run-smoke.ps1                                  # all flows
.\run-smoke.ps1 -Only auth-login,student-dashboard
```
Prints a PASS/FAIL table; exits non-zero if any flow fails. Screenshots land in `output/`.

## Journey mode (AI exploratory + verdict)
Invoke the `/qa-flows` skill (`.claude/skills/qa-flows/`) in a Claude Code session:
```
/qa-flows journey instructor-assign-tree
/qa-flows journey            # all journey-mode flows
```
The skill authenticates, walks each flow per `flows.md`, captures screenshots + console/
errors into `output/`, and returns PASS / FAIL / WARN with evidence paths.

## Catalog
`flows.md` is the source of truth. Each flow is `smoke`, `journey`, or `both`.
Adding a flow = add a catalog section (+ a `smoke/<id>.json` if deterministic).

## Output
`output/` is gitignored. Contains screenshots, videos, journey reports, saved auth state.
````

- [ ] **Step 3: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add web/qa/agent-browser/README.md && \
git commit -m "docs(qa): add agent-browser harness README"
```

---

## Task 7: The `/qa-flows` orchestration skill

**Files:**
- Create: `.claude/skills/qa-flows/SKILL.md`

- [ ] **Step 1: Write the skill**

Create `.claude/skills/qa-flows/SKILL.md`:
````markdown
---
name: qa-flows
description: Run the BootCamp agent-browser QA harness — deterministic smoke batches and/or AI exploratory journeys across student/instructor/public flows, with screenshot + console evidence and a PASS/FAIL/WARN verdict per flow. Use when asked to QA, smoke-test, dogfood, or verify BootCamp web flows end-to-end against the local stack. Triggers: "/qa-flows", "smoke test the app", "QA the instructor flows", "journey test login".
---

# qa-flows — BootCamp agent-browser QA

Drives the `agent-browser` CLI against the local BootCamp web app. Two modes:
**smoke** (deterministic batch replay) and **journey** (AI exploration + verdict).

Catalog (source of truth): `web/qa/agent-browser/flows.md`.
Harness assets: `web/qa/agent-browser/` (`smoke/*.json`, `run-smoke.ps1`, `output/`).

## Constants
- Base URL `http://localhost:3001` · API `:3002` · Postgres `:5433`.
- Seeded accounts (password `test1234`): `student@bootcamp.dev`, `instructor@bootcamp.dev`, `admin@bootcamp.dev`.
- agent-browser binary may need PATH: `export PATH="$PATH:/c/Users/ricma/AppData/Roaming/npm"`.
- Always use `agent-browser` directly, never `npx agent-browser`.

## Preconditions (run first, every mode)
1. Check the stack: web `:3001` and API `:3002` must be listening
   (PowerShell `Test-NetConnection 127.0.0.1 -Port 3001`). If down, tell the user to run
   `.\dev.ps1` (offer to run it). Do NOT proceed against a dead stack.
2. For any flow that mutates student progress (lesson submit, etc.), run `npm run seed`
   in `platform/` first (idempotent; resets the test student's attempts).
3. Ensure agent-browser + Chrome are installed (`agent-browser --version`; if Chrome is
   missing, `agent-browser install`).

## Mode: smoke
Deterministic, no judgment. Just run the runner and report its table.
```bash
pwsh -File web/qa/agent-browser/run-smoke.ps1            # all
pwsh -File web/qa/agent-browser/run-smoke.ps1 -Only auth-login,student-dashboard
```
Report the PASS/FAIL table verbatim and the exit code. A non-zero exit = failures;
attach the relevant `output/<flow>.png` paths for any FAIL.

## Mode: journey
AI exploratory pass per flow. Lean on agent-browser's own QA method:
`agent-browser skills get dogfood` (structured explore + screenshot + console/error + report).

For each requested flow (from `flows.md`; default = all `mode: journey` or `both`):
1. **Authenticate** for the flow's role. Reuse a saved state if present
   (`output/<role>.state.json` via `state load`); else form-login on `/login` with the
   seeded account and `state save` it.
2. **Walk the steps** in the catalog: at each meaningful step
   `snapshot -i` → act (`find …` / `click @eN`) → `screenshot --annotate output/journey-<flow>-<step>.png`.
3. **Capture health:** `agent-browser --session <s> errors` and `… console` after key actions.
4. **Evaluate against the catalog `verdict` criteria.** Decide:
   - **PASS** — all verdict criteria met, no console errors on core actions.
   - **WARN** — works but with a UX/cosmetic issue, or an ambiguous/uncertain finding.
   - **FAIL** — a verdict criterion is unmet, a crash, or console errors on a core action.
5. **Record evidence:** for any WARN/FAIL, save a screenshot (and a `record start/stop`
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
End with a summary line: `journey: X PASS / Y WARN / Z FAIL across N flows`.
For real bugs, offer to file via the `open-ticket` skill (do not auto-file).

## Default (no args)
Run **smoke** first (fast regression signal); then offer to run **journey** for new/risky
flows or anything that FAILED smoke.

## Adding coverage
Edit `web/qa/agent-browser/flows.md` (catalog). If the flow is deterministic, add a
`web/qa/agent-browser/smoke/<id>.json` batch and validate it with `run-smoke.ps1 -Only <id>`.
````

- [ ] **Step 2: Verify the skill is discoverable**

In a Claude Code session at the repo root, confirm `/qa-flows` appears in the skill list
(project `.claude/skills/` is auto-discovered). If invoking, it should load the SKILL.md
above.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/ricma/BootCamp && git add .claude/skills/qa-flows/SKILL.md && \
git commit -m "feat(qa): add /qa-flows orchestration skill (smoke + journey modes)"
```

---

## Task 8: End-to-end validation of both modes

This is the harness's own acceptance test (per the "verification is mandatory" rule).

- [ ] **Step 1: Smoke mode acceptance**

```powershell
cd C:\Users\ricma\BootCamp\platform ; npm run seed
cd C:\Users\ricma\BootCamp\web\qa\agent-browser ; .\run-smoke.ps1
```
Expected: all flows PASS, exit 0. Record the table.

- [ ] **Step 2: Journey mode acceptance (one flow)**

Drive `instructor-assign-tree` in journey mode end-to-end (authenticate instructor → walk
the composer assign flow → screenshots + console capture → emit the verdict block).
Expected: a PASS (or a substantiated WARN/FAIL with evidence) using the report format,
with screenshots present under `output/`.

- [ ] **Step 3: Confirm no evidence leaked into git**

```bash
cd /c/Users/ricma/BootCamp && git status --porcelain web/qa/agent-browser/output/
```
Expected: empty (only `.gitkeep` tracked). The `output/` ignore is working.

- [ ] **Step 4: Final summary commit (if any docs/tweaks pending)**

If Step 1–2 required stabilizing a batch or the skill, commit those fixes:
```bash
cd /c/Users/ricma/BootCamp && git add -A web/qa/agent-browser .claude/skills/qa-flows && \
git commit -m "fix(qa): stabilize smoke batches + skill after end-to-end validation"
```

---

## Self-Review (completed by plan author)

**Spec coverage check:**
- Hybrid (smoke + journey) → Tasks 2–6 (smoke) + Task 7 (journey skill). ✓
- Reusable skill, in-repo `.claude/skills/` → Task 7. ✓
- Comprehensive flow catalog across 3 roles → Task 1 `flows.md` (all spec flows present, each tagged smoke/journey/both). ✓
- Deterministic smoke + assertions drive exit code → Task 2 runner + assertion-terminated batches. ✓
- Auth via seeded accounts + state save/load → `_auth-student.json`, runner, skill. ✓
- Preconditions (stack health, seed, Chrome) → runner + skill preconditions. ✓
- Ports/startup, Windows-first PowerShell runner → Task 2, README. ✓
- Output gitignored → Task 0. ✓
- Verdict format (PASS/WARN/FAIL + evidence) → Task 7 skill. ✓
- Out-of-scope (CI, prod journeys, visual-diff, auto-ticketing) → respected; not in any task. ✓
- Testing the harness itself (negative control + e2e of both modes) → Task 3 Step 6 + Task 8. ✓

**Placeholder scan:** The only intentional placeholders are `REPLACE_WITH_*` and
`__DISCOVER__` tokens inside batch files — these are *required live-discovery points*
(selectors/copy that must come from the running app, not be invented), each paired with
an explicit instruction on what to capture. This is deliberate per the "selector discovery
is mandatory" convention, not a planning gap.

**Type/identifier consistency:** runner flag `-Only` and `-WebPort/-ApiPort`, helper file
`_auth-student.json` (excluded by the `_*` filter), assertion idiom (`wait --text` /
`wait --fn` / trailing `eval` throw), and the verdict block shape are used consistently
across runner, batches, README, and skill.
