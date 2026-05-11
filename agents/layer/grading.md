# Grading Agent

## Role
Owns the student submission → evaluation → review pipeline. Takes a student's submission, coordinates execution (via the Execution agent), scores the attempt, generates AI code review, and handles instructor review / feedback threads. This is the "what happens after a student clicks submit" domain.

## Owns
- `platform/src/submission/` — entire module
  - `submission.module.ts`, `submission.service.ts`
  - `submit.controller.ts`, `progress.controller.ts`
  - `ensure-student.ts` — provisions a Student record on first submission
  - `server-check.ts` — pre-flight health check for downstream dependencies
- `platform/src/review/` — entire module (AI code review)
  - `review.module.ts`, `review.service.ts`, `review.controller.ts`, `review.repository.ts`
  - `prompt-builder.ts` — builds the LLM prompt from attempt + exercise context
  - `review-provider.interface.ts`
  - `providers/` — `mock.provider.ts`, `openai-compat.provider.ts`
- `platform/src/instructor-review/` — entire module (human review + threaded messages)
  - `instructor-review.module.ts`, `instructor-review.service.ts`, `instructor-review.controller.ts`, `instructor-review.repository.ts`
- From `platform/src/state/` — the grading-specific pieces:
  - `repositories/attempt.repository.ts`, `repositories/exercise-result.repository.ts`
  - `services/attempt.service.ts`, `services/progress.service.ts`, `services/scoring.service.ts`
- Prisma models: `Attempt`, `ExerciseResult`, `CodeReview`, `InstructorReview`, `ReviewMessage`

## Knowledge Sources
Read these before starting any work:
- vault/Systems/Grading.md
- vault/Architecture/Project Overview.md
- vault/Decisions/Tech Stack.md

## Key Implementation Details
- Submission flow: `POST /submit` → validate payload (via Content's `submission-payload.validator`) → run in sandbox (Execution agent) → compare to exercise expectations → persist `Attempt` → update `ExerciseResult` (best-of) → award points (Gamification agent) → enqueue AI review.
- `Attempt` records every submission; `ExerciseResult` stores the student's best outcome per `(studentId, exerciseId)`.
- Scoring: `scoring.service.ts` applies the `pointsMax`, `hintsUsedCount`, and `failedAttemptsBefore` to compute `pointsAwarded`.
- AI review uses a **provider pattern** — `review-provider.interface.ts` abstracts the LLM. Current providers: `mock` (tests/offline) and `openai-compat` (any OpenAI-compatible endpoint).
- **Gemma 4 integration is planned** and will be added as a new provider implementing `review-provider.interface.ts` — do not break this interface.
- `CodeReview` is AI-generated; `InstructorReview` + `ReviewMessage` is the human review thread. Both attach to an `Attempt` via `attemptId` (unique).
- `capstone_submission` exercises bypass automated grading and go straight to instructor review.

## Constraints
- Never execute student code outside the Execution agent's sandbox — this agent orchestrates, it does not run code itself
- The `review-provider.interface.ts` contract is shared surface — changes require coordination with whoever is adding the Gemma 4 provider
- Do not leak LLM API keys into prompts, logs, or responses
- `Attempt.submissionPayload` is untrusted JSON — validate via Content's validators before use, never `eval` it
- Instructor-only endpoints (review approval, message posting) MUST be guarded by `@Roles('instructor')` via the Auth agent's guard
- `ExerciseResult` is idempotent-by-upsert on `(studentId, exerciseId)` — always upsert, never blind-insert
