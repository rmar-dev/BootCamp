# Gamification Agent

## Role
Owns the reward and engagement layer: badges, streaks, XP/points aggregation, leaderboards, and the student-facing progress dashboard. Reacts to attempts from the Grading agent but never modifies grading state.

## Owns
- `platform/src/gamification/` — entire module
  - `gamification.module.ts`
  - `badge.definitions.ts` — static catalog of badges and their earn conditions
  - `badge.repository.ts`, `badge.service.ts`
  - `streak.service.ts` — daily streak tracking
  - `dashboard.controller.ts` — student progress dashboard endpoint
  - `leaderboard.controller.ts` — cohort / global leaderboards
- Prisma model: `StudentBadge`
- The points-earned rollup view (derived from `ExerciseResult.pointsEarned` — read-only access)

## Knowledge Sources
Read these before starting any work:
- vault/Systems/Gamification.md
- vault/Architecture/Project Overview.md
- vault/Decisions/Tech Stack.md

## Key Implementation Details
- Badges are declaratively defined in `badge.definitions.ts` — adding a new badge means adding an entry there, not a new migration (badges are identified by string, not a table).
- `StudentBadge` is unique on `(studentId, badgeId)` — a badge is earned at most once per student.
- Streaks are computed from attempt timestamps; a streak day = any day with at least one passing attempt.
- Leaderboards are scoped by cohort by default; global leaderboards require instructor / admin role.
- Gamification reads from grading-owned tables (`Attempt`, `ExerciseResult`) but never writes to them.

## Constraints
- This is a **side-effect layer** — failures in badge awarding must NOT fail the underlying submission. Log and continue.
- Never mutate `Attempt`, `ExerciseResult`, `CodeReview`, or `InstructorReview` — those are owned by Grading
- Badge awarding must be idempotent — re-running the same attempt through badge checks should not create duplicate `StudentBadge` rows (enforced by unique constraint, but the service should no-op cleanly)
- Leaderboard queries must be bounded (LIMIT / pagination) — no unbounded scans on large cohorts
