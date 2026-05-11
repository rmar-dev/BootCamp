#!/usr/bin/env bash
#
# BootCamp single-VPS bootstrap.
#
# Run on a fresh Ubuntu 22.04 / 24.04 box. Idempotent: rerun safely.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rmar-dev/BootCamp/main/deploy/bootstrap.sh | sudo bash -s -- demo.example.com
# OR (after cloning):
#   sudo ./bootstrap.sh demo.example.com
#
# What it does:
#   1. Installs Docker engine + compose plugin (skips if present)
#   2. Clones the repo to /opt/bootcamp (skips if present)
#   3. Generates /opt/bootcamp/deploy/.env.prod with random secrets
#   4. Builds + brings up the prod stack via docker compose
#   5. Compiles the curriculum into the DB
#
# After it finishes, point your domain's DNS A record at this box's IP.
# Caddy auto-provisions the TLS cert on the first request (~10–30s).

set -euo pipefail

# ── 0. Sanity ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0 $*" >&2
  exit 1
fi

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  echo "Example: $0 demo.example.com" >&2
  exit 1
fi

REPO_URL="${BOOTCAMP_REPO_URL:-https://github.com/rmar-dev/BootCamp.git}"
INSTALL_DIR="${BOOTCAMP_INSTALL_DIR:-/opt/bootcamp}"
DEPLOY_DIR="$INSTALL_DIR/deploy"

log() { printf '\n\033[1;36m[bootstrap]\033[0m %s\n' "$*"; }

# ── 1. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker engine"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  log "Docker present: $(docker --version)"
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin missing. Reinstall Docker via get.docker.com." >&2
  exit 1
fi

# ── 2. Repo ──────────────────────────────────────────────────────────────────
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  log "cloning $REPO_URL → $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  log "repo present; pulling latest"
  git -C "$INSTALL_DIR" fetch --quiet
  git -C "$INSTALL_DIR" reset --hard origin/main --quiet
fi

cd "$DEPLOY_DIR"

# ── 3. .env.prod ─────────────────────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/.env.prod"
if [[ ! -f "$ENV_FILE" ]]; then
  log "generating $ENV_FILE with random secrets"
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  POSTGRES_PASS=$(openssl rand -hex 16)

  # GNU sed (Ubuntu default) — `-i` in place, no backup extension.
  sed -i "s|<JWT_SECRET>|$JWT_SECRET|g" "$ENV_FILE"
  sed -i "s|<JWT_REFRESH_SECRET>|$JWT_REFRESH|g" "$ENV_FILE"
  sed -i "s|<POSTGRES_PASSWORD>|$POSTGRES_PASS|g" "$ENV_FILE"
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" "$ENV_FILE"

  chmod 600 "$ENV_FILE"
  log "wrote $ENV_FILE (0600). Edit it to add GOOGLE_CLIENT_ID etc. if needed."
else
  log "$ENV_FILE exists; leaving it alone"
  # Bring DOMAIN in line if the operator passed a new one.
  current_domain=$(grep '^DOMAIN=' "$ENV_FILE" | head -1 | cut -d= -f2-)
  if [[ "$current_domain" != "$DOMAIN" ]]; then
    sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" "$ENV_FILE"
    log "updated DOMAIN to $DOMAIN"
  fi
fi

# ── 4. Build + bring up ─────────────────────────────────────────────────────
log "building images (first run takes 5–10 min)"
docker compose -f docker-compose.prod.yml --env-file .env.prod build --pull

log "starting the stack"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# ── 5. Wait for the platform health before seeding ───────────────────────────
log "waiting for platform to come online"
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T platform \
       node -e "fetch('http://127.0.0.1:3002/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    log "platform up"
    break
  fi
  # Fall back to plain TCP probe if /api/health isn't implemented.
  if docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T platform \
       sh -c 'wget -q -O /dev/null http://127.0.0.1:3002/ 2>/dev/null || curl -s -o /dev/null http://127.0.0.1:3002/'; then
    log "platform responds (no /health route)"
    break
  fi
  sleep 2
done

# ── 6. Seed curriculum into the DB ───────────────────────────────────────────
log "compiling curriculum into the production DB"
"$DEPLOY_DIR/seed-curriculum.sh" || log "curriculum seed skipped/failed — run seed-curriculum.sh manually"

# ── 7. Done ──────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -fsS https://api.ipify.org 2>/dev/null || echo '<this-box>')
cat <<EOF

────────────────────────────────────────────────────────────────────────
 BootCamp is live.
   URL:     https://$DOMAIN
   IP:      $PUBLIC_IP
   Env:     $ENV_FILE
   Compose: cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml --env-file .env.prod <cmd>
─────────────────────────────────────────────────────────────────────────

Point an A record for $DOMAIN at $PUBLIC_IP, then load the URL.
The first request triggers Caddy to fetch a Let's Encrypt cert (10–30 s).

To enable Level-3 sourcekit-lsp (browser IntelliSense), restart with the
\`lsp\` profile:
  docker compose -f docker-compose.prod.yml --env-file .env.prod --profile lsp up -d swift-lsp

Logs:
  docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail=200 platform
  docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail=200 web
  docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail=200 caddy
EOF
