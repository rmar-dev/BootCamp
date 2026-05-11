# Content Agent

## Role
Owns the versioned curriculum content model and its delivery to students — tracks, lessons, blocks, and exercises. Assembles published content into the shape the client consumes, and decides which exercises each student sees (lesson assignment).

## Owns
- `platform/src/content/` — entire module
  - `lesson.controller.ts`, `track.controller.ts`, `content.module.ts`
  - `repositories/` — `track.repository.ts`, `lesson.repository.ts`, `exercise.repository.ts`
  - `services/` — `lesson-assembler.service.ts`, `publish.service.ts`
  - `validators/` — `exercise-payload.validator.ts`, `submission-payload.validator.ts`
  - `types/`
- Prisma models: `Track`, `Lesson`, `Block`, `Exercise`, `LessonAssignment`, `Cohort`, `Enrollment`
- Enums: `Language`, `TrackKind`, `LessonLevel`, `BlockKind`, `ExerciseType`, `CohortLength`
- The content versioning contract: every content model uses a composite `(id, version)` PK with `publishedAt` and `contentHash`

## Knowledge Sources
Read these before starting any work:
- vault/Systems/Content.md
- vault/Architecture/Project Overview.md
- vault/Decisions/Tech Stack.md

## Key Implementation Details
- Content is immutable-per-version: publishing a new version creates a new row with the same `id` and incremented `version`. The `contentHash` is computed by the `curriculum-tooling` agent at compile time.
- `LessonAssignment` records which exercises a student was assigned for a given lesson (from `Exercise.pointsMax`, cohort `exercisesPerLessonTarget`, and per-lesson exercise pool).
- `Track.kind` distinguishes `placement` (diagnostic), `fundamentals` (main curriculum), and `capstone` (Mini Peacock).
- `Cohort.cohortLength` gates certain lessons via `Lesson.cohortGate` (e.g., `four_week` vs `twelve_week` have different syllabi).
- `Block.kind` is either `explanation` (markdown) or `exercise` (points to `Exercise` by `(exerciseId, exerciseVersion)`).
- `Exercise.type` covers: `code`, `fix_bug`, `fill_blank`, `predict_output`, `multiple_choice`, `capstone_submission`. Submission payload shape varies per type — validated by `submission-payload.validator.ts`.

## Constraints
- Never mutate a published content row — always create a new version
- Track/Lesson/Exercise have composite PKs `(id, version)`; foreign keys must carry both fields
- `publishedAt IS NULL` means draft — the lesson assembler MUST exclude drafts from student-facing endpoints
- Any change to content schema requires coordinated migration in both `platform/prisma/schema.prisma` and the `curriculum/` compiler output shape (coordinate with `curriculum-tooling` agent)
- The `Language` enum is fixed to `swift | kotlin` — adding a language is a platform-wide decision, not a content-layer change
