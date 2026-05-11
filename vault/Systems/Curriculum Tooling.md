# Curriculum Tooling

## Purpose
Offline compiler and publisher: turns authored markdown + payload JSON into the versioned rows that the platform's `content` module serves to students. Runs as a build/publish step, never at request time.

## Owns
- `curriculum/` — the whole top-level package
  - `compile.ts` (CLI entry)
  - `src/compiler.ts`, `src/parser.ts`, `src/hasher.ts`, `src/publisher.ts`, `src/validator.ts`
  - `swift-fundamentals/` — current authored track source
  - Own `package.json`, `tsconfig.json`, `prisma/`

## Key Interfaces
- `npm run compile` (or similar) — reads `swift-fundamentals/` → validates → hashes → upserts to DB
- The published DB rows: `Track`, `Lesson`, `Block`, `Exercise` (composite PK `(id, version)`)
- Validator contract — must stay in sync with `platform/src/content/validators/exercise-payload.validator.ts`

## Dependencies
- Same Postgres DB as `platform/`
- Prisma client version must match `platform/`

## Invariants
- `contentHash` algorithm is stable — changing it invalidates all existing version-skip detection
- Unchanged content = no new version (idempotent publish)
- Drafts are never written with `publishedAt` set
- Authoring surface (`swift-fundamentals/`) optimized for non-engineers; compiler internals optimized for engineers
