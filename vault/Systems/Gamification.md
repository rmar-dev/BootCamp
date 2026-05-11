# Gamification

## Purpose
The rewards and engagement layer: badges, streaks, points rollup, leaderboards, and the student progress dashboard. Side-effect-only relative to grading — reads grading tables, writes only its own.

## Owns
- `platform/src/gamification/` (all services, repositories, controllers, `badge.definitions.ts`)
- Prisma model: `StudentBadge`

## Key Interfaces
- `GET /dashboard` — student's own progress, points, badges, streak
- `GET /leaderboard` (cohort-scoped by default)
- `BadgeService.checkAndAward(studentId, context)` — called after each attempt
- `StreakService.recordActivity(studentId, date)` — called on passing attempts

## Dependencies
- Reads: `Attempt`, `ExerciseResult` (owned by Grading)
- Writes: `StudentBadge` only

## Invariants
- Badge awarding failures never fail the underlying submission
- Idempotent: re-processing an attempt never double-awards
- Badge definitions live in code (`badge.definitions.ts`), not the DB — identified by string ID
