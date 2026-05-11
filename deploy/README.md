# BootCamp — Production Deploy on a Single VPS

One-box demo deployment. ~45 min from a fresh provider account to a working
public URL.

## What this gives you

- Always-on demo at `https://your-domain.com`
- Automatic TLS via Let's Encrypt (Caddy handles it)
- Sign in with email, Google OAuth, or (if configured) Sign in with Apple
- All 12 weeks of Swift curriculum already in the DB
- Multiple-choice / fill-blank / predict-output exercises auto-graded
- Swift + Kotlin code execution in sandboxed containers
- Capstone submission (video upload metadata stored in Postgres)
- Optional Level-3 sourcekit-lsp IntelliSense (gated by `--profile lsp`)

## What's NOT here

- Multi-tenant isolation (single shared platform process)
- Production-grade backups (add `pg_dump` + S3 if you keep this alive long-term)
- DDoS protection beyond what Cloudflare DNS gives you
- Horizontal scaling (single box; runners share docker socket)

For a demo or a 1–50 person cohort, this is enough. For a production product,
treat it as a starting point.

---

## 1. Provision a VPS

Recommended: **Hetzner Cloud — CX21** (2 vCPU, 4 GB RAM, 40 GB SSD, ~€6/mo).
The Swift toolchain image is ~2 GB and Swift compilation is RAM-hungry;
anything smaller starts swapping under load. CX31 (8 GB) if you want headroom
for L3 LSP plus active runners.

| Provider | SKU | Why |
|----------|-----|-----|
| **Hetzner** | CX21 (€6) or CX31 (€10) | Best price/perf |
| DigitalOcean | s-2vcpu-4gb ($24) | Pricier; faster control plane |
| Vultr / Linode | 4 GB regular | Comparable to DO |
| Hetzner CAX21 (ARM, €5) | works too | Cheaper, ARM-native. Swift image has ARM64 builds. |

After provisioning:
- OS: **Ubuntu 24.04 LTS** (22.04 also fine)
- SSH key authentication
- No firewall rules needed beyond the provider default (open 22/80/443)

## 2. Point a domain at it

In your DNS provider (Cloudflare, Route 53, Namecheap, whatever), create an
**A record** for the demo subdomain pointing at the VPS's public IP. e.g.

```
demo.yourdomain.com.   300   IN   A   135.181.X.Y
```

Don't enable the Cloudflare orange-cloud proxy on first run — Caddy can't
fetch a Let's Encrypt cert through it until DNS-01 challenge is configured.
Plain DNS-only proxy works fine.

## 3. Run the bootstrap

```bash
ssh root@your-vps-ip

# One command — installs Docker, clones the repo, generates secrets, brings up the stack
curl -fsSL https://raw.githubusercontent.com/rmar-dev/BootCamp/main/deploy/bootstrap.sh \
  | bash -s -- demo.yourdomain.com
```

What you'll see:
1. Docker install (~1 min, skipped if already present)
2. Repo clone (~10 s)
3. Image build (~5–10 min on first run — Swift base image is the long one)
4. Stack starts
5. Migration apply (5 s)
6. Curriculum compile into DB (~30 s — publishes 12 weeks of Swift lessons)
7. Health check passes → script prints the URL

Visit `https://demo.yourdomain.com`. The first request triggers Caddy to
provision a TLS cert; it might pause 10–30 s while that happens. After that,
instant.

## 4. (Optional) Add Google OAuth

If you want Sign in with Google, edit `/opt/bootcamp/deploy/.env.prod`:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

In the Google Cloud Console add the authorised redirect URI:

```
https://demo.yourdomain.com/api/auth/google/callback
```

Then restart the platform:

```bash
cd /opt/bootcamp/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod restart platform
```

Same idea for Sign in with Apple — add the Service ID with the redirect URI
matching your domain, populate the env vars, restart.

## 5. (Optional) Turn on Level-3 IntelliSense

The static IntelliSense layer (L1+L2) is on by default. To also serve the
semantic sourcekit-lsp WebSocket, restart with the `lsp` profile:

```bash
cd /opt/bootcamp/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile lsp up -d swift-lsp
```

You don't need to change the web side — Caddy proxies `/lsp` to the LSP
container when it exists, and the web client connects to that path
automatically when `NEXT_PUBLIC_LSP_URL` is set at build time. For demo
runs that don't need it, leave it off and the static layer carries you.

---

## Operations

### Logs

```bash
cd /opt/bootcamp/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f platform
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f caddy
```

### Update to latest main

```bash
cd /opt/bootcamp
git pull
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod build --pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

(Re-running `bootstrap.sh` also works; it's idempotent.)

### Reset the demo data

If you've let demo viewers loose and want to start clean:

```bash
cd /opt/bootcamp/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod down
docker volume rm bootcamp_postgres-data
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
./seed-curriculum.sh
```

Caddy's TLS cert state lives in `bootcamp_caddy-data` — keep that one or
you'll hit Let's Encrypt rate limits if you reset often.

### Backups (if you keep it alive longer)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U bootcamp bootcamp | gzip > backup-$(date +%F).sql.gz
```

Pair with `restic` or a cron + S3 upload for unattended backups.

### Tear it all down

```bash
cd /opt/bootcamp/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v
# -v removes volumes too. Drop the VPS to stop billing.
```

---

## Troubleshooting

### Caddy can't get a TLS cert

- Check DNS: `dig +short demo.yourdomain.com` must return your VPS IP
- Check that port 80 is open externally (Hetzner firewall + OS firewall)
- Caddy logs: `docker compose ... logs caddy`
- Let's Encrypt rate-limits: 5 failed attempts/hour. If you keep retrying
  with broken DNS you'll get throttled; wait an hour.

### Login works but dashboard is blank

- Almost always a missing migration. The platform applies migrations on
  startup via the entrypoint; if the platform container is in a crashloop,
  check `docker compose ... logs platform`.

### Code-execution exercises hang

- Docker socket not mounted, or runner containers not up. Verify:

  ```bash
  docker ps --filter name=bootcamp-swift-runner --format '{{.Status}}'
  docker exec bootcamp-platform-prod docker ps --filter name=bootcamp-swift-runner
  ```

  The second command must succeed — it proves the platform can see the
  host docker socket.

### "Out of memory" during build

- 4 GB is the minimum; the Swift toolchain build needs all of it. Upgrade
  to CX31 (8 GB) or temporarily add swap:

  ```bash
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  ```
