# BootCamp Obsidian Brain Vault — Design

**Date:** 2026-04-08
**Status:** Approved

## Purpose

A hybrid Obsidian vault that serves two purposes in one place:

1. **Personal knowledge base** — daily notes, atomic zettelkasten notes, and maps of content (MOCs) for emergent knowledge linking.
2. **Project documentation** — specs, decisions, and references tied to work in this repo.

The repo directory `c:/Users/ricma/BootCamp` *is* the vault — opening it in Obsidian opens the vault directly.

## Folder Structure

```
BootCamp/
├── .obsidian/              # Obsidian config (core plugins, app settings)
├── daily/                  # Daily notes (YYYY-MM-DD.md)
├── zettel/                 # Atomic notes — default location for new notes
├── projects/               # Project docs, specs, decisions (repo-tied)
├── resources/              # Reference material, clippings, reading notes
│   └── attachments/        # Image/file attachments
├── maps/                   # MOCs — index notes linking to zettel clusters
├── templates/              # Note templates
├── docs/                   # Meta-docs about the vault itself (this spec lives here)
└── README.md               # Vault overview + conventions
```

Each top-level folder has a single, clear purpose:

- **daily/** — capture log, one file per day, created from `templates/daily-note.md`
- **zettel/** — atomic notes (one idea per note), heavily linked, no subfolders
- **projects/** — long-form project documentation, specs, ADRs
- **resources/** — external references, reading notes, clippings, attachments
- **maps/** — Maps of Content: index notes that organize zettel clusters by topic

## Obsidian Configuration

Core plugins only — no community plugins. The vault works immediately on first open without downloads.

**Enabled core plugins:**
- `daily-notes` — daily capture
- `templates` — template insertion
- `graph` — link visualization
- `backlinks` — backlink pane
- `outline` — note outline pane
- `tag-pane` — tag browser
- `file-explorer` — folder tree
- `global-search` — search across vault
- `command-palette` — keyboard-driven command runner
- `page-preview` — hover previews
- `word-count` — status bar word count

**App settings:**
- Theme: dark (`obsidian` mode)
- New link format: **relative path to file** (so links survive moving the vault)
- Use `[[wikilinks]]`: enabled
- Default location for new notes: `zettel/`
- Attachments folder: `resources/attachments/`

**Daily Notes plugin settings:**
- Folder: `daily/`
- Date format: `YYYY-MM-DD`
- Template: `templates/daily-note.md`

**Templates plugin settings:**
- Templates folder: `templates/`

## Templates

Four templates in `templates/`:

### `daily-note.md`
A dated capture page with three sections: *Notes* (free-form), *Captured* (links/snippets gathered today), *Links* (related notes). Auto-applied by Daily Notes.

### `zettel.md`
Atomic note skeleton: single-concept title, body, *Related* section for wikilinks to neighbors, tags line at bottom. The unit of knowledge in the vault.

### `moc.md`
Map of Content: a topic header, *Notes in this cluster* as a wikilink list, *See also* for adjacent MOCs. MOCs are how clusters of zettel become navigable.

### `project-doc.md`
Project documentation skeleton: status line, summary, body, *Decisions* section (lightweight ADR-style log), *References* (links to relevant code/specs/external docs).

## README.md

Brief vault overview at the repo root: what the vault is, the purpose of each top-level folder, how to open it in Obsidian (File → Open Vault → select this folder), and the note conventions:

- **Zettel** = one idea per note, linked liberally to others
- **MOCs** = index notes that organize zettel by topic
- **Daily notes** = capture log, not durable knowledge
- **Projects** = long-form, repo-tied documentation

## Out of Scope

- Community plugins (Dataview, Templater, Excalidraw, etc.) — not installed or referenced
- Custom themes
- Sample/example content beyond the templates themselves
- Git initialization — the directory is not a git repo and this spec does not initialize one
- Sync configuration (Obsidian Sync, git-based sync)

## Success Criteria

- Opening `c:/Users/ricma/BootCamp` in Obsidian shows the vault with all folders, configured core plugins active, and templates available via the command palette.
- Creating a new note via "New note" places it in `zettel/`.
- Running "Open today's daily note" creates a file in `daily/` from the daily-note template.
- The README explains the structure clearly enough that a new user (or future-you) can navigate without further instruction.
