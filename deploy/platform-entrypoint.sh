#!/bin/sh
# Run pending Prisma migrations against the production DB, then exec the
# main process. Idempotent — applies only what hasn't been applied.
set -e
echo "[platform] applying migrations…"
npx prisma migrate deploy
echo "[platform] migrations ok, starting server"
exec "$@"
