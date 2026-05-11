# Spec #9 — Curriculum Authoring Tooling

**Date:** 2026-04-13
**Status:** Design approved
**Depends on:** Spec #1 (content & curriculum model)

## Summary

A standalone TypeScript compiler that reads curriculum authored as markdown-with-frontmatter files, validates them against the existing Zod schemas, and upserts directly into the Postgres database via Prisma Client. Content-addressed hashing ensures only changed content gets new versions. An optional `--publish` flag publishes all new versions.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source file location | BootCamp root `curriculum/` directory (C) | Close to platform, separate from NestJS source, authors don't need to understand the codebase |
| Compilation target | Direct DB writes (A) | Reuses existing validation, no intermediate format |
| File structure | One file per lesson (B) | Mirrors the student experience — everything on one page in one file |
| Block delimiter | YAML frontmatter blocks separated by `---` (A) | Clean, self-describing, easy to parse programmatically |
| Versioning | Content-addressed hashing (B) | Authors just edit and recompile — no manual version tracking, preserves student progress references |
| Publishing | Draft by default, `--publish` flag (B) | Safety net against accidental publishes, single command to remember |
| Architecture | Standalone script with direct Prisma access (B) | Fast, no NestJS boot overhead, clear separation as a build tool |

## File Format

### Track file — `curriculum/<track-slug>/track.md`

```markdown
---
id: swift-fundamentals
title: Swift Fundamentals
language: swift
kind: fundamentals
description: Learn Swift from the ground up
lessons:
  - 01-intro
  - 02-variables
  - 03-functions
---
```

The `id` field is a human-readable slug used to derive a stable deterministic UUID. The `lessons` array references lesson filenames (without `.md`) in order.

### Lesson file — `curriculum/<track-slug>/01-intro.md`

```markdown
---
type: lesson
title: Introduction to Swift
level: beginner
summary: Your first Swift program
---

Swift is a modern, safe language created by Apple...

---
type: exercise
kind: code
language: swift
pointsMax: 100
hints:
  - Use the print() function
concepts:
  - functions
  - io
---

Write a function that prints "Hello, World!"

```swift:starter
func hello() {
  // your code here
}
```

```swift:test
import XCTest
class Tests: XCTestCase {
  func testHello() { hello() }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 50
---

What keyword declares a constant in Swift?

- [x] `let`
- [ ] `var`
- [ ] `const`
- [ ] `final`
```

### Parsing Rules

- `---` delimiters split the file into blocks.
- First block must have `type: lesson` — its frontmatter is lesson metadata, its body is ignored.
- Subsequent blocks without a `type` field (or with no frontmatter) are explanation blocks — their markdown body becomes `Block.explanationMarkdown`.
- Blocks with `type: exercise` are exercise blocks — frontmatter has exercise metadata, body is the prompt markdown.
- Code fences tagged `:starter`, `:test`, `:broken` map to payload fields (`starterCode`, `testCode`, `brokenCode`).
- `testEntryPoint` is set explicitly in exercise frontmatter (e.g. `testEntryPoint: Tests`) or defaults to `"Tests"` for Swift and `"TestKt"` for Kotlin.
- Multiple choice uses GitHub-flavored checkbox syntax: `- [x]` for correct, `- [ ]` for incorrect. Multiple `[x]` entries set `multiSelect: true`.

### Exercise Type Mapping

| Frontmatter `kind` | Required code fences | Payload fields populated |
|---------------------|---------------------|--------------------------|
| `code` | `:starter`, `:test` | `language`, `starterCode`, `testCode`, `testEntryPoint` |
| `fix_bug` | `:broken`, `:test` | `language`, `brokenCode`, `testCode`, `testEntryPoint` |
| `fill_blank` | `:starter` (with `___N` placeholders) | `language`, `template`, `blanks[]` — each `___N` placeholder generates a blank with `id: "N"`. Expected values listed in frontmatter as `blanks: { "1": ["let"], "2": ["String"] }` |
| `predict_output` | `:starter` (display only) | `displayedCode`, `displayedLanguage`, `expectedOutput` — expected output specified in frontmatter as `expectedOutput: "Hello, World!"` |
| `multiple_choice` | none | `questionMarkdown` (from body), `options[]`, `correctOptionIds[]`, `multiSelect` |

## Content Hashing & Versioning

### Stable IDs

Each entity gets a deterministic UUID via `uuid5`:

- Track: `uuid5(namespace, "track:<track-slug>")`
- Lesson: `uuid5(namespace, "lesson:<track-slug>/<lesson-slug>")`
- Exercise: `uuid5(namespace, "exercise:<track-slug>/<lesson-slug>/<exercise-index>")`

The namespace is a fixed UUID constant in the compiler. Same content path always produces the same ID across fresh compilations.

### Content Hashing

Before creating a new version, the compiler hashes each entity's normalized content:

- Exercise: `sha256(JSON.stringify({ promptMarkdown, payload, hints, concepts, pointsMax }))`
- Lesson: `sha256(JSON.stringify({ title, level, summary, blockHashes[] }))`
- Track: `sha256(JSON.stringify({ title, language, kind, description, lessonHashes[] }))`

### Compilation Flow Per Entity

1. Compute stable ID from slug path.
2. Compute content hash from current file content.
3. Look up latest version in DB: `findFirst({ where: { id }, orderBy: { version: 'desc' } })`.
4. If no existing version → `create` with version 1.
5. If existing version's `contentHash` matches → skip (no change).
6. If hash differs → `create` with version N+1.

## Compiler Pipeline

The compiler is at `curriculum/compile.ts`:

```
Read files -> Parse markdown -> Validate -> Hash -> Diff against DB -> Upsert -> (optional) Publish
```

### Stages

1. **Discovery** — glob `curriculum/*/track.md` to find all tracks. For each track, read the `lessons` array and load the corresponding `.md` files.

2. **Parsing** — split each lesson file on `---` delimiters. Classify blocks (lesson metadata, explanation, exercise). Extract tagged code fences from exercise bodies.

3. **Validation** — run exercise payloads through existing Zod schemas (imported from `platform/src/content/validators/exercise-payload.validator.ts`). Report all validation errors with file path and block index before writing anything.

4. **Hashing & Diffing** — compute stable IDs and content hashes. Query the DB for current versions. Build a changeset: which entities need a new version, which are unchanged.

5. **Writing** — for each changed entity, call Prisma to create the new version. Build Block records and Lesson `blockIds` arrays from the parsed structure. Update Track's `lessonIds`/`lessonVersions` parallel arrays.

6. **Publishing** — if `--publish` flag is set, set `publishedAt` on all new versions bottom-up (exercises -> lessons -> track).

### Error Handling

The compiler validates everything before writing anything. If any file has validation errors, it prints them all and exits without touching the DB. All-or-nothing compile per track.

### CLI Interface

```bash
npx tsx curriculum/compile.ts                    # compile all tracks (draft)
npx tsx curriculum/compile.ts --publish          # compile + publish
npx tsx curriculum/compile.ts swift-fundamentals # compile one track
```

## Schema Change

Add `contentHash` (nullable String) to Track, Lesson, and Exercise models:

```prisma
model Track {
  // ... existing fields ...
  contentHash  String?
}

model Lesson {
  // ... existing fields ...
  contentHash  String?
}

model Exercise {
  // ... existing fields ...
  contentHash  String?
}
```

Nullable so existing seeded data (with `contentHash: null`) doesn't need migration backfill. The compiler treats null as "always recompile."

## Dependencies

The `curriculum/` directory gets its own `package.json`:

| Package | Purpose |
|---------|---------|
| `@prisma/client` | DB access (reuses platform's generated client) |
| `gray-matter` | YAML frontmatter parsing |
| `uuid` | Deterministic uuid5 generation |
| `tsx` | TypeScript runner |
| `vitest` | Test framework |

A `tsconfig.json` in `curriculum/` resolves imports from `../platform/src/` for the shared Zod validators.

## Testing Strategy

### Unit tests (~10-12 tests)

- **Parser** — markdown splitting, block classification, code fence extraction. Edge cases: empty explanation blocks, exercises with no hints, multiple choice with single answer, code with no starter.
- **Validator integration** — compiler correctly passes/rejects payloads through Zod schemas. All 5 exercise types with valid and invalid payloads.
- **Hashing** — stable ID generation is deterministic. Content hash changes when content changes, stays stable when unchanged.
- **Multiple choice parser** — `- [x]`/`- [ ]` checkbox syntax extracts correct/incorrect options, handles multiSelect.

### Integration tests (~5-8 tests, require DB)

- **Full compile cycle** — write markdown to temp dir, run compiler, verify entities in DB.
- **Idempotency** — compile twice, verify no new versions on second run.
- **Version bump** — compile, change exercise, recompile, verify version 2 only for changed exercise.
- **Publish flag** — compile with `--publish`, verify `publishedAt` set.
- **Validation errors** — invalid payloads leave DB untouched, errors reported.

### Sample Curriculum

Include `curriculum/swift-fundamentals/` with 2 lessons, ~4 exercises covering all 5 types. Serves as both test fixture and format documentation.

## Out of Scope

- Web-based content editor / CMS UI.
- Git-based content review workflow (PRs for curriculum changes).
- Content preview (rendering lessons without publishing).
- Diff/changelog reporting between versions.
- Rollback to previous versions.
