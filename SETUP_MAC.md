# BootCamp — Mac local setup

End-to-end recipe for getting the platform + web running on macOS for next
week's presentation. Mirrors the Windows `dev.ps1` flow with `dev.sh`.

## 1. Prerequisites

Install in this order. If you already have any of these, skip.

```bash
# Homebrew (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Git
brew install git

# Node 20 LTS via nvm (project uses ts-node + Next 14 + Nest 10)
brew install nvm
mkdir -p ~/.nvm
# Add to ~/.zshrc (or ~/.bash_profile):
#   export NVM_DIR="$HOME/.nvm"
#   [ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"
# Then reload your shell, then:
nvm install 20
nvm use 20
```

Docker Desktop for Mac — install from <https://www.docker.com/products/docker-desktop/>
(or `brew install --cask docker`). Open Docker Desktop once after installing
so it can boot the daemon. **All Docker commands below assume the daemon is
running.**

Sanity-check:

```bash
node --version    # v20.x
npm --version     # 10.x
docker info       # should print, not error
git --version
```

## 2. Clone

```bash
mkdir -p ~/code && cd ~/code
git clone <your-bootcamp-remote-url> BootCamp
cd BootCamp
```

If you don't have a remote yet, `scp -r` from your Windows box or use a
`.zip` of the repo. The repo has no submodules.

## 3. Install dependencies

Three workspaces — install each:

```bash
( cd platform   && npm install )    # Nest API + Prisma + Postgres client
( cd web        && npm install )    # Next.js 14 app
( cd curriculum && npm install )    # offline markdown → DB compiler
```

`platform/`'s postinstall runs `prisma generate` automatically, so the
Prisma client is ready as soon as `npm install` finishes.

## 4. Environment files

Two `.env` files are needed. **They contain secrets — do not commit them.**

### `platform/.env`

```bash
cat > platform/.env <<'EOF'
DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public"
JWT_SECRET="dev-only-change-me-in-prod-32-chars-min"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3002/api/auth/google/callback"
FRONTEND_URL="http://localhost:3001"
ALLOWED_EMAIL_DOMAIN=""
WEB_ORIGIN="http://localhost:3001"
EOF
```

Google OAuth fields are blank — local dev uses email/password (Test
Student / Test Instructor accounts seeded in step 6). If you want Google
SSO during the demo, paste credentials from your GCP project.

### `web/.env.local`

```bash
cat > web/.env.local <<'EOF'
NEXT_PUBLIC_API_BASE=http://localhost:3002
EOF
```

Port 3002 (not 3000) avoids a known collision with another local dev
server on port 3000.

## 5. The one-shot dev script

```bash
chmod +x dev.sh
./dev.sh
```

`dev.sh` is the macOS mirror of `dev.ps1`. It:

1. Verifies the Docker daemon is reachable.
2. Brings up Postgres (`:5433`) + the Swift / Kotlin sandbox runners via
   `docker compose up -d` from `platform/`.
3. Waits for Postgres to accept connections.
4. Applies any pending Prisma migrations (`prisma migrate deploy`) and
   regenerates the client.
5. Runs the Prisma seed (`npm run seed`) — creates the Test Student,
   Test Instructor, **Dev Cohort**, links the Test Student to that
   cohort + instructor, and inserts the Hello BootCamp lesson.
6. Publishes the Swift Fundamentals curriculum (12 lessons, ~125
   exercises) via the offline compiler. Idempotent — content-hash skips
   unchanged content.
7. Spawns the Nest API in a new Terminal window on `:3002`.
8. Spawns the Next.js dev server in a new Terminal window on `:3001`.

Override ports via env:

```bash
WEB_PORT=4000 API_PORT=4001 ./dev.sh
```

Stop: close the two spawned Terminal windows (Ctrl-C each). Postgres and
the runners stay up. To stop those too:

```bash
( cd platform && docker compose down )
```

## 6. Log in for the demo

Open <http://localhost:3001>.

Two seeded accounts (password `test1234` for both):

| Role | Email | What you can do |
|---|---|---|
| Instructor | `instructor@bootcamp.dev` | All `/instructor/*` pages: Students roster, Skill tree composer, Help inbox, Ratings, Builder. Has the Dev Cohort assigned as cohort lead. |
| Student | `student@bootcamp.dev` | Lesson player, dashboard, profile. Enrolled in the Dev Cohort with the Test Instructor as their personal mentor. |

## 7. Demo path (suggested order for the presentation)

1. **Log in as student** → Dashboard → "Continue lesson" into Hello
   BootCamp. Show the lesson runtime.
2. **Log out, log in as instructor** → `/instructor` (review queue —
   probably empty unless you submit one as the student first).
3. `/instructor/students` → see the Test Student in the assigned tab.
   Click in for the detail view; flip the difficulty dial to Easy /
   Challenging to demo per-student tuning.
4. `/instructor/skill-tree` → Track picker auto-loads Swift
   Fundamentals; cohort picker auto-loads "Dev Cohort (Spring 2026)".
   Click "Save as new tree…" → name it "Accelerated Swift" → save.
   Drag/swap a few lessons → click "Save changes". Then click
   "Activate on cohort" — that's the moment students see the
   customised Your Path.
5. `/instructor/builder` → fork an existing lesson → tweak a block →
   Publish. New lesson version is created and the cohort sees it.
6. `/instructor/help` → demo the inbox + threaded reply (you'll need
   the student to file one first via the lesson page's "Need help?"
   button — the student-side surface for that is the next-iteration
   work).
7. `/instructor/ratings` → paste a capstone-attempt UUID (from a
   manual submission as student) → rate it 4/5 with a comment. Show
   the multi-rater list.

## 8. Common gotchas

- **`createTree failed: 500`** with "table SkillTree does not exist"
  → migrations weren't applied. `cd platform && npx prisma migrate deploy`
  fixes it. (`dev.sh` does this automatically; only relevant if you
  bypass it.)
- **Cohort dropdown empty** on `/instructor/skill-tree` → seed didn't
  run, or you logged in as an instructor that doesn't lead any cohort.
  Re-run `cd platform && npx prisma db seed`.
- **Docker not running** → `./dev.sh` exits at step 1. Open Docker
  Desktop from /Applications, wait for the whale icon to stop
  animating, retry.
- **Port already in use** (3001, 3002, or 5433) → either kill the
  squatter (`lsof -i :3002` → `kill -9 <pid>`) or override via
  `WEB_PORT` / `API_PORT` env vars (5433 is fixed in
  `platform/docker-compose.yml`; edit if necessary).
- **Prisma generate fails on macOS with "EPERM"** → another node
  process is holding the engine. Run `pkill -f "node.*platform"`
  then retry.
- **Sandbox runners (`bootcamp-swift-runner` / `bootcamp-kotlin-runner`)
  fail to start** — those are needed only for student code execution
  during a live submit. The demo tracks (Hello BootCamp + Swift
  Fundamentals) include code exercises that need them. If they fail,
  inspect with `docker compose logs swift-runner kotlin-runner` from
  `platform/`. Skip them for a UI-only demo by stopping just those two
  containers.

## 9. Test suites (optional, but useful pre-demo confidence)

```bash
# Platform — DB-free unit tests
( cd platform && npx jest --testPathIgnorePatterns="\\.e2e-spec\\.ts" \
    --testPathIgnorePatterns="repository\\.spec\\.ts" \
    --testPathIgnorePatterns="\\.controller\\.spec\\.ts" )

# Platform — full suite (needs Postgres up; dev.sh leaves it up)
( cd platform && npm test )

# Web — vitest
( cd web && npx vitest run )

# Web — Playwright e2e (smoke; opens browser)
( cd web && npx playwright install --with-deps && npx playwright test )

# Curriculum — vitest
( cd curriculum && npx vitest run )
```

Expected: ~99 G-related unit tests pass plus the existing baseline
(~250+ across the three workspaces).

## 10. Resetting if a demo goes sideways

```bash
# Wipe the Postgres data volume (loses all student progress)
( cd platform && docker compose down -v )

# Then re-run dev.sh — it'll recreate the schema + reseed.
./dev.sh
```

## 11. Architecture cheat-sheet for Q&A

- **`platform/`** — NestJS API. Modules: `auth` (JWT + Google OAuth +
  local), `content` (Track / Lesson / Block / Exercise versioning),
  `state` (Student / Cohort / Attempt / ExerciseResult),
  `submission` + `execution` (sandboxed code run via dockerode),
  `instructor-content` (lesson authoring), `help` (request inbox),
  `ratings` (multi-rater), `students` (roster + difficulty),
  `skill-tree` (named multi-tree authoring + cohort assignment),
  `gamification` (badges, streaks, leaderboard).
- **`web/`** — Next.js 14 App Router. Auth gated under
  `app/(authed)/(shell)/` (chrome) and `app/(authed)/(immersive)/`
  (full-bleed lesson runtime).
- **`curriculum/`** — offline TS package. Compiles markdown +
  frontmatter into Prisma rows with content-hash versioning.
- **Postgres** — `:5433` in dev. Schema lives in
  `platform/prisma/schema.prisma`. 22+ migrations under
  `platform/prisma/migrations/`.
- **Sandboxes** — Swift 5.10 + Kotlin 1.9.25 containers with no network
  access, no filesystem writes outside `/tmp` and `/work` tmpfs, 256 MB
  memory limits, 5–10 s timeouts.
