# Content

## Purpose
Store, version, and deliver curriculum content — tracks, lessons, blocks, exercises — and assign exercises to students based on cohort and lesson state.

## Owns
- `platform/src/content/` (repositories, services, validators, controllers)
- Prisma models: `Track`, `Lesson`, `Block`, `Exercise`, `LessonAssignment`, `Cohort`, `Enrollment`

## Key Interfaces
- `GET /tracks`, `GET /tracks/:id` — track listing and detail
- `GET /lessons/:id` — lesson with assembled blocks
- `submission-payload.validator.ts` — validates student submission shape per `ExerciseType` (shared contract with `curriculum-tooling`)
- `lesson-assembler.service.ts` — fans out a lesson into its blocks and resolves the assigned exercises for the current student

## Dependencies
- Prisma
- `curriculum-tooling` writes the content rows this module reads
- Auth (for `currentUser` on personalized assembly)
