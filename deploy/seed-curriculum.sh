#!/usr/bin/env bash
#
# Compile the curriculum markdown into the production database.
# Idempotent: re-running only writes changed tracks/lessons/exercises.
#
# Run from the deploy/ directory, or with $DEPLOY_DIR set.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")" && pwd)}"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml --env-file $DEPLOY_DIR/.env.prod"

# Run the compile in a one-shot container that mounts the curriculum tree and
# talks to the running Postgres service. We reuse the platform image since it
# already has node + the prisma client + a compatible toolchain.

# Read DATABASE_URL from the platform service env (single source of truth).
DB_URL=$($COMPOSE exec -T platform printenv DATABASE_URL)

# The curriculum tooling lives in the repo at /opt/bootcamp/curriculum
# (whatever INSTALL_DIR was). Resolve relative to this script.
ROOT=$(cd "$DEPLOY_DIR/.." && pwd)

echo "[seed] running curriculum compile:publish against the prod DB"
docker run --rm \
  --network bootcamp_bootcamp \
  -e DATABASE_URL="$DB_URL" \
  -v "$ROOT/curriculum":/curriculum \
  -w /curriculum \
  node:20-alpine \
  sh -c "apk add --no-cache openssl >/dev/null && npm ci --silent && npx prisma generate && npm run compile:publish"

echo "[seed] done"
