# CI Workflows

Two GitHub Actions wired in this repo:

| Workflow | File | When | Surface |
|----------|------|------|---------|
| **CI** | `ci.yml` | Every PR to `main`, every push to `main` | Path-filtered: only the changed subproject(s) run |
| **Nightly health** | `nightly.yml` | 03:00 UTC daily + manual dispatch | Full matrix; opens a tracking Issue on failure |

## What each job does

### CI (`ci.yml`)

A `changes` job uses `dorny/paths-filter` to set `web` / `platform` / `curriculum`
booleans based on what the PR touched. Each downstream job is gated on its
boolean — touch only `curriculum/`, and the web + platform jobs sit out.

Each subproject job runs roughly:

- `npm ci`
- `tsc --noEmit` (typecheck)
- `npm run lint` (where available — currently web only)
- `npm test` (vitest / jest)
- For `web`: `next build` (catches RSC/SSR mistakes not visible in unit tests)
- For `platform`: brings up an ephemeral Postgres service so Prisma-generated code resolves
- For `curriculum`: the new `curriculum-files.test.ts` parses *every* `track.md` + lesson markdown on disk and builds payloads for every exercise — so a broken lesson fails here before merge.

A `ci-status` fan-in job consolidates outcomes for **branch protection rules**.
Make it a required check in your branch protection so PRs can't merge red.

### Nightly (`nightly.yml`)

Runs unconditionally (no path filter), plus:

- `prisma migrate deploy` on `platform`
- `npm run compile:publish` on `curriculum` against an ephemeral Postgres — proves the full author→DB pipeline still works
- `npm audit` summary (informational; doesn't fail the build)
- `alert-on-failure` job opens (or updates) an Issue labeled `nightly-failure` and `ci` so you don't miss a quiet rot

## Prerequisites — do these once

The workflow files exist on disk but won't run until the repo lives on GitHub.

### 1. Initialize git + push

```powershell
git init
git add .
git commit -m "Initial commit"

# Create a new repo on GitHub (web UI or `gh repo create`), then:
git remote add origin git@github.com:<you>/BootCamp.git
git branch -M main
git push -u origin main
```

The first push triggers `CI` on `main`. The nightly fires at 03:00 UTC the next morning.

### 2. (Recommended) Branch protection

In GitHub → Settings → Branches → `main`, add a branch protection rule:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass — pick **`CI status`** (the fan-in job)
- ✅ Require branches to be up to date before merging

This makes red PRs unmergeable.

### 3. (Optional) Notifications

Default behavior: failing nightly opens an Issue. To also get a Slack/email
ping, add a step in `nightly.yml`'s `alert-on-failure` job that posts to your
channel of choice — or just rely on GitHub's email-on-Issue.

## Cost / runtime notes

- Public repo → free unlimited CI.
- Private repo → counts against your GitHub Actions minutes. Path filtering keeps PR CI cheap (5–10 min worst case touching all three subprojects, ~2 min touching one).
- Concurrency cancellation: a force-push to a PR cancels the older run. Saves both minutes and your patience.

## Adding a new subproject later

If you add a fourth folder (say `mobile/`):

1. Add a `mobile` filter to `ci.yml`'s `changes` job.
2. Add a `mobile` job mirroring `web` / `platform`.
3. Add `needs.mobile.result == 'failure'` to the nightly's `alert-on-failure`.
4. Add `mobile` to `ci-status`'s `needs:` list.
