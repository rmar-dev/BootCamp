#!/usr/bin/env bash
# dev.sh — single-command BootCamp dev stack (macOS / Linux)
#
# Mirrors dev.ps1: starts Postgres + sandbox runners in Docker, applies
# pending Prisma migrations, seeds the dev DB, publishes the Swift
# Fundamentals curriculum, and launches the Nest API + Next.js web app
# in two separate Terminal windows (macOS) / xterm (Linux).
#
# Usage:   ./dev.sh                   web on :3001, API on :3002
#          WEB_PORT=3000 ./dev.sh     override web port
#          API_PORT=3000 ./dev.sh     override API port (use this if :3002
#                                     is in use)
#
# Stop:    close the two spawned terminal windows (Ctrl-C each), then
#          `docker compose down` in platform/ if you want Postgres down too.

set -euo pipefail

WEB_PORT="${WEB_PORT:-3001}"
API_PORT="${API_PORT:-3002}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

C_STEP="\033[36m"; C_OK="\033[90m"; C_DONE="\033[32m"; C_RED="\033[31m"; C_YEL="\033[33m"; C_RESET="\033[0m"
step() { printf "${C_STEP}>> %s${C_RESET}\n" "$1"; }
ok()   { printf "${C_OK}   %s${C_RESET}\n" "$1"; }
done_msg() { printf "${C_DONE}>> %s${C_RESET}\n" "$1"; }

# ── 1. Docker check ────────────────────────────────────────────────────────
step "Ensuring Docker daemon is reachable"
if ! docker info >/dev/null 2>&1; then
  printf "${C_RED}   Docker is not running. Start Docker Desktop and re-run this script.${C_RESET}\n"
  exit 1
fi
ok "docker daemon reachable"

# ── 2. Postgres + sandbox runners ──────────────────────────────────────────
step "Bringing up Postgres (5433) + sandbox runners"
cd "$ROOT_DIR/platform"
docker compose up -d >/dev/null

step "Waiting for Postgres to accept connections"
ready=0
for _ in $(seq 1 30); do
  if docker exec bootcamp-postgres pg_isready -U bootcamp >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
if [[ $ready -ne 1 ]]; then
  printf "${C_RED}   Postgres did not become ready within 30s.${C_RESET}\n"
  exit 1
fi
ok "postgres ready"

# ── 3. Prisma: generate + apply migrations ─────────────────────────────────
# `migrate deploy` is the production-mode applier (no interactive prompts).
# It applies any pending migrations in order and is safe to re-run.
step "Applying Prisma migrations"
npx prisma migrate deploy >/dev/null
ok "migrations applied"

step "Regenerating Prisma client"
npx prisma generate >/dev/null
ok "prisma client up to date"

# ── 4. Seed (creates Test Student / Test Instructor + Dev Cohort) ──────────
step "Seeding dev users + Hello BootCamp lesson"
npm run seed

# ── 4b. Publish Swift Fundamentals curriculum (idempotent) ─────────────────
step "Publishing Swift Fundamentals curriculum"
cd "$ROOT_DIR/curriculum"
DATABASE_URL="postgresql://bootcamp:bootcamp@127.0.0.1:5433/bootcamp?schema=public" \
  npx tsx compile.ts --publish swift-fundamentals
cd "$ROOT_DIR/platform"

# ── 5. Spawn Nest + Next in separate terminal windows ──────────────────────
# macOS uses Terminal.app via osascript. Linux falls back to xterm /
# gnome-terminal / konsole, in that order. If none are found, we print
# the commands to run manually.

spawn_term() {
  local title="$1"
  local workdir="$2"
  local cmd="$3"

  if [[ "$(uname)" == "Darwin" ]]; then
    osascript <<EOF >/dev/null
tell application "Terminal"
  do script "cd '$workdir' && echo '🌟 $title' && $cmd"
  set custom title of front window to "$title"
end tell
EOF
  elif command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -c "cd '$workdir' && echo '🌟 $title' && $cmd; exec bash"
  elif command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p "tabtitle=$title" -e bash -c "cd '$workdir' && $cmd; exec bash" &
  elif command -v xterm >/dev/null 2>&1; then
    xterm -T "$title" -e bash -c "cd '$workdir' && $cmd; exec bash" &
  else
    printf "${C_YEL}   No supported terminal emulator found. Run these manually:${C_RESET}\n"
    printf "${C_YEL}     [%s]   cd '%s' && %s${C_RESET}\n" "$title" "$workdir" "$cmd"
  fi
}

step "Launching Nest API on http://localhost:$API_PORT (new window)"
spawn_term \
  "BootCamp :: Nest API (:$API_PORT)" \
  "$ROOT_DIR/platform" \
  "PORT=$API_PORT WEB_ORIGIN=http://localhost:$WEB_PORT npm run start"

step "Launching Next.js web on http://localhost:$WEB_PORT (new window)"
spawn_term \
  "BootCamp :: Next Web (:$WEB_PORT)" \
  "$ROOT_DIR/web" \
  "NEXT_PUBLIC_API_BASE=http://localhost:$API_PORT npx next dev -p $WEB_PORT"

# ── 6. Done ────────────────────────────────────────────────────────────────
cd "$ROOT_DIR"
echo ""
done_msg "Stack is starting. Give both windows a few seconds to boot."
echo ""
printf "${C_YEL}   Web:  http://localhost:%s${C_RESET}\n" "$WEB_PORT"
printf "${C_YEL}   API:  http://localhost:%s${C_RESET}\n" "$API_PORT"
echo ""
printf "${C_OK}   Login as instructor@bootcamp.dev / test1234 (or student@bootcamp.dev / test1234).${C_RESET}\n"
printf "${C_OK}   Stop: close the two spawned windows. Postgres stays up until you${C_RESET}\n"
printf "${C_OK}   run 'docker compose down' in platform/.${C_RESET}\n"
