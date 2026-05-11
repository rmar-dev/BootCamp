# BootCamp — Brain Vault

[![CI](https://github.com/rmar-dev/BootCamp/actions/workflows/ci.yml/badge.svg)](https://github.com/rmar-dev/BootCamp/actions/workflows/ci.yml)
[![Nightly](https://github.com/rmar-dev/BootCamp/actions/workflows/nightly.yml/badge.svg)](https://github.com/rmar-dev/BootCamp/actions/workflows/nightly.yml)

A hybrid Obsidian vault: personal knowledge base + project documentation, in one place.

> **Deploying to a VPS?** The single-VPS deploy bundle (Caddy + docker-compose +
> bootstrap script) now lives in its own repo: [rmar-dev/vps-deploy](https://github.com/rmar-dev/vps-deploy).
> It can host BootCamp alone or alongside other apps (currently: Constructhub).

## Open in Obsidian

1. Open Obsidian
2. **File → Open vault → Open folder as vault**
3. Select this directory (`BootCamp`)

The `.obsidian/` folder is preconfigured with core plugins, dark theme, daily notes, and templates — no community plugins required.

## Folder layout

| Folder | Purpose |
|---|---|
| `daily/` | Daily notes — capture log, one file per day (`YYYY-MM-DD.md`) |
| `zettel/` | Atomic notes — one idea per note, linked liberally. Default location for new notes. |
| `maps/` | Maps of Content (MOCs) — index notes that organize zettel by topic |
| `projects/` | Project documentation, specs, decisions tied to repo work |
| `resources/` | Reference material, reading notes, clippings |
| `resources/attachments/` | Image and file attachments |
| `templates/` | Note templates: `daily-note`, `zettel`, `moc`, `project-doc` |
| `docs/` | Meta-docs about the vault itself (e.g., the design spec) |

## Conventions

- **Zettel** — one idea per note. Title is the idea. Body is short. Link to related zettel via `[[wikilinks]]`. Don't worry about hierarchy; let the graph emerge.
- **MOCs** — when a zettel cluster grows, create a Map of Content in `maps/` to index it. MOCs are how you navigate the graph by topic.
- **Daily notes** — capture log only, not durable knowledge. Promote anything worth keeping to a zettel.
- **Projects** — long-form docs tied to specific work. Each project doc has a status, summary, decisions log, and references.

## Creating notes

- **New atomic note** — `Ctrl+N` (lands in `zettel/`)
- **Today's daily note** — Command palette → "Daily notes: Open today's daily note"
- **From a template** — Command palette → "Templates: Insert template" → pick one

## Why this structure

The vault serves two roles at once:

1. A **second brain** — daily capture, atomic notes, emergent organization via links and MOCs
2. A **project doc home** — specs and decisions for work in this repo

Keeping both in one vault means project work and the knowledge that informs it live next to each other and link freely.

See [`docs/superpowers/specs/2026-04-08-obsidian-brain-vault-design.md`](docs/superpowers/specs/2026-04-08-obsidian-brain-vault-design.md) for the full design rationale.
