# Curriculum-Tooling Agent

## Role
Owns the offline authoring pipeline that turns human-authored curriculum source (markdown + YAML + code samples) into the versioned, hash-stable rows consumed by the `content` module at runtime. Lives in its own workspace outside `platform/` and runs as a build/publish step, not at request time.

## Owns
- `curriculum/` — entire top-level package
  - `compile.ts` — top-level CLI entry
  - `src/compiler.ts`, `src/parser.ts`, `src/hasher.ts`, `src/publisher.ts`, `src/validator.ts`
  - `swift-fundamentals/` — authored curriculum source (the current track content)
  - `tests/`
  - Its own `package.json`, `tsconfig.json`, `prisma/` (points at the same DB for publish)
- The compiled output contract — whatever the `publisher.ts` writes into the platform's `Track` / `Lesson` / `Block` / `Exercise` tables

## Knowledge Sources
Read these before starting any work:
- vault/Systems/Curriculum Tooling.md
- vault/Architecture/Project Overview.md
- vault/Decisions/Tech Stack.md

## Key Implementation Details
- The compiler reads authored source (markdown + frontmatter + exercise payload JSON), validates it, computes a stable `contentHash`, and upserts versioned rows.
- `hasher.ts` defines the canonical hash function — changing it breaks idempotency of republishes, so treat as a stable contract.
- `validator.ts` enforces schema shape BEFORE the DB ever sees the content — this is where authoring errors get caught.
- Publishing is version-bumping: if `contentHash` has changed, a new `(id, version+1)` row is created with `publishedAt` set; if unchanged, the publish is a no-op.
- Exercise payloads vary by `ExerciseType` — the compiler's validator must match the runtime validator in `platform/src/content/validators/exercise-payload.validator.ts`.

## Constraints
- **Validator symmetry** — this compiler's validator and the platform's runtime `exercise-payload.validator.ts` must accept/reject the same payloads. Coordinate with the `content` agent before changing either.
- Never write draft content with `publishedAt` set — drafts must remain filtered from student-facing queries.
- The `contentHash` algorithm is load-bearing for version-skip detection; any change requires a coordinated full re-hash of existing content.
- This package has its own `node_modules` and does not share with `platform/` — dependency versions may drift but Prisma client version must match `platform/` to avoid schema mismatch.
- Curriculum source files are the authoring surface — prioritize legibility for non-engineer authors (instructors) over compiler ergonomics.
