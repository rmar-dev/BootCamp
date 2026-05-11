#!/usr/bin/env bash
#
# BootCamp single-VPS bootstrap, with optional sibling apps.
#
# Usage on a fresh Ubuntu 22.04 / 24.04 box:
#   sudo ./bootstrap.sh <bootcamp-domain> [--with constructhub <constructhub-domain>]
#
# Examples:
#   sudo ./bootstrap.sh bootcamp.example.com
#   sudo ./bootstrap.sh bootcamp.example.com --with constructhub app.constructhub.example.com
#
# What it does:
#   1. Installs Docker engine + compose plugin (skips if present)
#   2. Creates the shared `web-edge` docker network if missing
#   3. Clones BootCamp to /opt/bootcamp (skips if present)
#   4. Generates /opt/bootcamp/deploy/.env.prod with random secrets
#   5. Builds + brings up the BootCamp stack
#   6. (Optional) Clones Constructhub + brings it up under the same Caddy

set -euo pipefail

# ── 0. Sanity ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0 $*" >&2
  exit 1
fi

BOOTCAMP_DOMAIN="${1:-}"
if [[ -z "$BOOTCAMP_DOMAIN" || "$BOOTCAMP_DOMAIN" == --* ]]; then
  cat <<USAGE >&2
Usage: $0 <bootcamp-domain> [--with constructhub <constructhub-domain>]

Examples:
  $0 bootcamp.example.com
  $0 bootcamp.example.com --with constructhub app.constructhub.example.com
USAGE
  exit 1
fi
shift

WITH_CONSTRUCTHUB=false
CONSTRUCTHUB_DOMAIN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with)
      shift
      case "${1:-}" in
        constructhub)
          WITH_CONSTRUCTHUB=true
          shift
          CONSTRUCTHUB_DOMAIN="${1:-}"
          if [[ -z "$CONSTRUCTHUB_DOMAIN" ]]; then
            echo "ERROR: --with constructhub requires a domain argument" >&2
            exit 1
          fi
          shift
          ;;
        *)
          echo "ERROR: unknown app for --with: ${1:-}" >&2
          exit 1
          ;;
      esac
      ;;
    *)
      echo "ERROR: unrecognised argument: $1" >&2
      exit 1
      ;;
  esac
done

BOOTCAMP_REPO_URL="${BOOTCAMP_REPO_URL:-https://github.com/rmar-dev/BootCamp.git}"
CONSTRUCTHUB_REPO_URL="${CONSTRUCTHUB_REPO_URL:-https://github.com/rmar-dev/constructhub.git}"
BOOTCAMP_DIR="${BOOTCAMP_DIR:-/opt/bootcamp}"
CONSTRUCTHUB_DIR="${CONSTRUCTHUB_DIR:-/opt/constructhub}"
DEPLOY_DIR="$BOOTCAMP_DIR/deploy"

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
  echo "ERROR: docker compose plugin missing. Reinstall via get.docker.com." >&2
  exit 1
fi

# ── 2. Shared edge network ───────────────────────────────────────────────────
if ! docker network inspect web-edge >/dev/null 2>&1; then
  log "creating shared docker network: web-edge"
  docker network create web-edge
else
  log "shared network web-edge already exists"
fi

# ── 3. Clone BootCamp ────────────────────────────────────────────────────────
if [[ ! -d "$BOOTCAMP_DIR/.git" ]]; then
  log "cloning BootCamp → $BOOTCAMP_DIR"
  git clone "$BOOTCAMP_REPO_URL" "$BOOTCAMP_DIR"
else
  log "BootCamp repo present; pulling latest"
  git -C "$BOOTCAMP_DIR" fetch --quiet
  git -C "$BOOTCAMP_DIR" reset --hard origin/main --quiet
fi

cd "$DEPLOY_DIR"

# ── 4. .env.prod for BootCamp ────────────────────────────────────────────────
ENV_FILE="$DEPLOY_DIR/.env.prod"
if [[ ! -f "$ENV_FILE" ]]; then
  log "generating $ENV_FILE with random secrets"
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH=$(openssl rand -hex 32)
  POSTGRES_PASS=$(openssl rand -hex 16)

  sed -i "s|<JWT_SECRET>|$JWT_SECRET|g" "$ENV_FILE"
  sed -i "s|<JWT_REFRESH_SECRET>|$JWT_REFRESH|g" "$ENV_FILE"
  sed -i "s|<POSTGRES_PASSWORD>|$POSTGRES_PASS|g" "$ENV_FILE"
  sed -i "s|^BOOTCAMP_DOMAIN=.*|BOOTCAMP_DOMAIN=$BOOTCAMP_DOMAIN|" "$ENV_FILE"

  chmod 600 "$ENV_FILE"
  log "wrote $ENV_FILE (0600)"
else
  log "$ENV_FILE exists; updating domain only"
  sed -i "s|^BOOTCAMP_DOMAIN=.*|BOOTCAMP_DOMAIN=$BOOTCAMP_DOMAIN|" "$ENV_FILE"
fi

# If Constructhub is requested, set its domain in BootCamp's env so the
# shared Caddyfile activates the second site block.
if $WITH_CONSTRUCTHUB; then
  if grep -q '^CONSTRUCTHUB_DOMAIN=' "$ENV_FILE"; then
    sed -i "s|^CONSTRUCTHUB_DOMAIN=.*|CONSTRUCTHUB_DOMAIN=$CONSTRUCTHUB_DOMAIN|" "$ENV_FILE"
  else
    echo "CONSTRUCTHUB_DOMAIN=$CONSTRUCTHUB_DOMAIN" >> "$ENV_FILE"
  fi
fi

# ── 5. Build + bring up BootCamp ─────────────────────────────────────────────
log "building BootCamp images (first run takes 5–10 min)"
docker compose -f docker-compose.prod.yml --env-file .env.prod build --pull

log "starting the BootCamp stack"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# ── 6. Wait for platform health ──────────────────────────────────────────────
log "waiting for BootCamp platform to come online"
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T platform \
       sh -c 'wget -q -O /dev/null http://127.0.0.1:3002/ 2>/dev/null || curl -s -o /dev/null http://127.0.0.1:3002/' 2>/dev/null; then
    log "platform up"
    break
  fi
  sleep 2
done

# ── 7. Seed curriculum ───────────────────────────────────────────────────────
log "compiling curriculum into the BootCamp DB"
"$DEPLOY_DIR/seed-curriculum.sh" || log "curriculum seed skipped — run seed-curriculum.sh manually if needed"

# ── 8. (Optional) Bring up Constructhub ──────────────────────────────────────
if $WITH_CONSTRUCTHUB; then
  log "── adding Constructhub at $CONSTRUCTHUB_DOMAIN ─────────────────────"

  if [[ ! -d "$CONSTRUCTHUB_DIR/.git" ]]; then
    log "cloning Constructhub → $CONSTRUCTHUB_DIR"
    git clone "$CONSTRUCTHUB_REPO_URL" "$CONSTRUCTHUB_DIR"
  else
    log "Constructhub repo present; pulling latest"
    git -C "$CONSTRUCTHUB_DIR" fetch --quiet
    git -C "$CONSTRUCTHUB_DIR" reset --hard origin/main --quiet 2>/dev/null \
      || git -C "$CONSTRUCTHUB_DIR" reset --hard origin/master --quiet
  fi

  CH_DEPLOY_DIR="$DEPLOY_DIR/sites/constructhub"
  CH_ENV_FILE="$CH_DEPLOY_DIR/.env.prod"
  if [[ ! -f "$CH_ENV_FILE" ]]; then
    log "generating $CH_ENV_FILE with random secrets"
    cp "$CH_DEPLOY_DIR/.env.example" "$CH_ENV_FILE"
    CH_POSTGRES_PASS=$(openssl rand -hex 16)
    sed -i "s|<POSTGRES_PASSWORD>|$CH_POSTGRES_PASS|g" "$CH_ENV_FILE"
    sed -i "s|^CONSTRUCTHUB_REPO_PATH=.*|CONSTRUCTHUB_REPO_PATH=$CONSTRUCTHUB_DIR|" "$CH_ENV_FILE"
    chmod 600 "$CH_ENV_FILE"
    log "wrote $CH_ENV_FILE (0600)"
  fi

  log "building Constructhub images"
  docker compose -f "$CH_DEPLOY_DIR/docker-compose.yml" --env-file "$CH_ENV_FILE" build --pull

  log "starting the Constructhub stack"
  docker compose -f "$CH_DEPLOY_DIR/docker-compose.yml" --env-file "$CH_ENV_FILE" up -d

  log "reloading Caddy so the new site block takes effect"
  docker compose -f docker-compose.prod.yml --env-file .env.prod \
    exec -T caddy caddy reload --config /etc/caddy/Caddyfile
fi

# ── 9. Done ──────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -fsS https://api.ipify.org 2>/dev/null || echo '<this-box>')
echo
echo "────────────────────────────────────────────────────────────────────────"
echo " Deployment complete."
echo ""
echo " BootCamp:      https://$BOOTCAMP_DOMAIN"
if $WITH_CONSTRUCTHUB; then
  echo " Constructhub:  https://$CONSTRUCTHUB_DOMAIN"
fi
echo " IP:            $PUBLIC_IP"
echo " Env:           $ENV_FILE"
echo "────────────────────────────────────────────────────────────────────────"
echo ""
echo "Make sure DNS A records exist:"
echo "  $BOOTCAMP_DOMAIN   →   $PUBLIC_IP"
if $WITH_CONSTRUCTHUB; then
  echo "  $CONSTRUCTHUB_DOMAIN   →   $PUBLIC_IP"
fi
echo ""
echo "Caddy provisions TLS certs on the first request to a fresh domain (~10–30s)."
echo ""
echo "Logs:"
echo "  docker compose -f $DEPLOY_DIR/docker-compose.prod.yml --env-file $DEPLOY_DIR/.env.prod logs -f"
if $WITH_CONSTRUCTHUB; then
  echo "  docker compose -f $DEPLOY_DIR/sites/constructhub/docker-compose.yml --env-file $DEPLOY_DIR/sites/constructhub/.env.prod logs -f"
fi
