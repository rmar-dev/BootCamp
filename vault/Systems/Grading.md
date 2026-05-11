# Grading

## Purpose
Everything that happens after a student clicks submit: run the code, score it, store the attempt, generate AI review, and optionally route to an instructor for human review.

## Owns
- `platform/src/submission/`, `platform/src/review/`, `platform/src/instructor-review/`
- Grading slice of `platform/src/state/`: `attempt.repository`, `exercise-result.repository`, `attempt.service`, `progress.service`, `scoring.service`
- Prisma models: `Attempt`, `ExerciseResult`, `CodeReview`, `InstructorReview`, `ReviewMessage`

## Key Interfaces
- `POST /submit` — student submission entry point
- `GET /progress/...` — student progress view
- `review-provider.interface.ts` — pluggable LLM provider (mock, openai-compat, future: Gemma 4)
- `GET/PATCH /instructor-review/...` — instructor-facing endpoints
- `POST /instructor-review/:id/messages` — threaded feedback

## Submission Flow
1. Validate payload shape (Content validator)
2. Execute in sandbox (Execution agent) — skipped for `capstone_submission`
3. Compare output to exercise expectations → `passed: boolean`
4. Persist `Attempt`
5. Upsert `ExerciseResult` (best-of by `(studentId, exerciseId)`)
6. Fire-and-forget: award points rollup (Gamification reads from this)
7. Enqueue AI review → produces `CodeReview`
8. If instructor-review required → create `InstructorReview` row

## Dependencies
- Execution (sandbox runner)
- Content (payload validators, exercise metadata)
- Auth (current student, role guards for instructor endpoints)
- Review providers (external LLM APIs)

## Planned
- Gemma 4 provider in `review/providers/` — must implement `review-provider.interface.ts` without changing the interface
