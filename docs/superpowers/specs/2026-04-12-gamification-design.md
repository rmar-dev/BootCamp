# Spec #6 — Gamification (Streaks, Leaderboards, Badges)

**Date:** 2026-04-12
**Status:** Design approved, awaiting implementation plan
**Depends on:** Specs #1–5 (content, lesson runtime, execution, auth, submission — all on `master` at `c9f1dba`)
**Successor specs:** #7 (AI code review), #8 (human instructor review)

## Goal

Add motivational game mechanics on top of the existing points system: daily streaks (consecutive days of submissions), a student leaderboard (ranked by total points), and 8 achievement badges unlocked by milestones. A new `/dashboard` page shows all three. The header gains a streak fire indicator. Badge unlocks appear inline in submit results.

## Non-goals

- Configurable badge definitions via admin UI — badges are hardcoded constants for V1
- Weekly/monthly leaderboard periods — all-time only
- XP curves, leveling, or experience tiers — points are flat
- Push notifications for streaks at risk
- Hints affecting scoring (hintsUsedCount remains 0)
- Social features (following, commenting, sharing badges)

## Data model

### New: `StudentBadge` entity

```prisma
model StudentBadge {
  id        String   @id @db.Uuid
  studentId String   @db.Uuid
  badgeId   String
  earnedAt  DateTime @default(now())

  @@unique([studentId, badgeId])
  @@index([studentId])
}
```

No Badge definition table — definitions are hardcoded in `badge.definitions.ts`.

### Badge definitions (hardcoded)

```ts
export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export const BADGES: BadgeDefinition[] = [
  { id: 'first_submit',   name: 'First Steps',     description: 'Submit your first exercise',             icon: '🚀' },
  { id: 'first_pass',     name: 'Nailed It',        description: 'Pass an exercise on the first try',      icon: '🎯' },
  { id: 'streak_3',       name: 'On a Roll',        description: '3-day submission streak',                 icon: '🔥' },
  { id: 'streak_7',       name: 'Week Warrior',     description: '7-day submission streak',                 icon: '⚡' },
  { id: 'all_types',      name: 'Full Spectrum',    description: 'Pass at least one of each exercise type', icon: '🌈' },
  { id: 'points_100',     name: 'Century',          description: 'Earn 100+ total points',                  icon: '💯' },
  { id: 'points_500',     name: 'High Achiever',    description: 'Earn 500+ total points',                  icon: '🏆' },
  { id: 'perfect_lesson', name: 'Perfect Lesson',   description: 'Pass all exercises in a lesson',          icon: '⭐' },
];
```

### Streaks — derived, not stored

Streaks are computed on-read from `Attempt.submittedAt` timestamps. No separate tracking table. A streak is the count of consecutive calendar days (UTC) ending today (or yesterday for "alive but at risk") where the student made at least one submission.

## Architecture

### New backend module

```
platform/src/
  gamification/
    gamification.module.ts
    badge.definitions.ts          (BADGES constant + BadgeDefinition type)
    badge.repository.ts           (StudentBadge CRUD)
    badge.service.ts              (check conditions + award after each submission)
    streak.service.ts             (compute streak from Attempt timestamps)
    leaderboard.controller.ts     (GET /api/leaderboard)
    dashboard.controller.ts       (GET /api/dashboard/me)
```

`GamificationModule` imports `StateModule` (AttemptRepository, ExerciseResultRepository, StudentRepository), `ContentModule` (for lesson/exercise lookups used by `perfect_lesson` badge), `AuthModule` (guards).

### Badge check flow

Called from `SubmissionService.submit()` after `AttemptService.recordAttempt()`:

```
BadgeService.checkAndAward(studentId, context) → BadgeDefinition[]

Where context = {
  attempt: Attempt,
  exerciseResult: ExerciseResult,
  totalPoints: number,
  exerciseType: ExerciseType,
  lessonId: string,
  lessonVersion: number,
}
```

For each badge definition, check the condition:

| Badge | Condition |
|---|---|
| `first_submit` | Student has ≥1 attempt total (this is always true on first call) |
| `first_pass` | This attempt passed AND `attempt.failedAttemptsBefore === 0` |
| `streak_3` | `StreakService.getCurrentStreak(studentId).current >= 3` |
| `streak_7` | `StreakService.getCurrentStreak(studentId).current >= 7` |
| `all_types` | Student has passed ExerciseResults covering all 5 exercise types (query ExerciseResult + join Exercise for type) |
| `points_100` | `totalPoints >= 100` |
| `points_500` | `totalPoints >= 500` |
| `perfect_lesson` | All exercises in the attempt's lesson are passed (via `ProgressService.isLessonCompleted`) |

For each condition that is newly met (badge not already in `StudentBadge`), insert a `StudentBadge` row. Return the list of newly awarded `BadgeDefinition[]`.

The check is synchronous (no event bus, no queue). A submission that doesn't unlock anything adds ~3ms of badge-check overhead (a few DB reads). Acceptable for bootcamp scale.

### Streak computation

`StreakService.getCurrentStreak(studentId)`:

```sql
SELECT DISTINCT DATE("submittedAt" AT TIME ZONE 'UTC') as d
FROM "Attempt"
WHERE "studentId" = $1
ORDER BY d DESC
```

Walk the result set backward from today:
1. If today (UTC) is in the set, `activeToday = true`, start counting from today.
2. Else if yesterday is in the set, `activeToday = false`, start counting from yesterday.
3. Else streak is 0.
4. Count consecutive days backward from the start date.

Returns `{ current: number, activeToday: boolean }`.

### Leaderboard endpoint

`GET /api/leaderboard?cohortId=<optional>`

Requires `JwtAuthGuard`.

```ts
type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  totalPoints: number;
  streak: number;
};

type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  myRank: number | null;
};
```

Implementation: query all students (optionally filtered by `cohortId`), for each sum `ExerciseResult.pointsEarned`, sort descending, compute rank, compute streak. Limit 50 entries. Include `myRank` (the authenticated student's position, even if not in top 50).

For tens of students this is a simple query with no performance concerns.

### Dashboard endpoint

`GET /api/dashboard/me`

Requires `JwtAuthGuard`.

```ts
type DashboardResponse = {
  streak: { current: number; activeToday: boolean };
  badges: Array<BadgeDefinition & { earnedAt: string }>;
  allBadges: BadgeDefinition[];
  rank: number | null;
  totalPoints: number;
};
```

Returns the student's personal stats. `allBadges` is the full `BADGES` array so the UI can show earned vs unearned. `badges` is the subset the student has earned, with `earnedAt` timestamps.

### Modified `SubmitResponse`

The existing `SubmitResponse` gains one field:

```ts
type SubmitResponse = {
  // ... existing fields ...
  newBadges: Array<{ id: string; name: string; icon: string }>;
};
```

`newBadges` is empty if no badges were unlocked by this submission. The web UI renders badge unlock notifications inline in the result panel.

## Web UI changes

### Header update

Next to the "125 pts" counter (from spec #5), add a streak indicator when streak > 0:

```
🔥 3 | 125 pts | ⚙ Settings
```

Fetched from `GET /api/dashboard/me` on mount (same call that could initialize totalPoints — or piggyback on the existing progress fetch). Updated after each submit if the streak changes.

### Submit result — badge unlock

When `submitResponse.newBadges.length > 0`, render below the PointsBadge:

```
🚀 Badge unlocked: First Steps!
```

One line per badge. Green accent. Appears inline in the exercise result area — not a modal or toast.

### New `/dashboard` page

Accessible from the header (link on "125 pts" or a dedicated nav item). Three sections:

1. **Stats card:** streak (big number with 🔥), total points, global rank (e.g., "#3 of 12")
2. **Badges grid:** earned badges shown with icon + name + earnedAt date. Unearned shown grayed out with description of how to unlock.
3. **Leaderboard table:** top 20 students, columns: rank, name, points, streak. Current student's row highlighted. If the student isn't in top 20, their row is pinned at the bottom with "..." separator.

Dark-mode-aware, matching the existing design system.

### New web files

```
web/
  app/dashboard/page.tsx
  lib/gamification.ts           (fetchDashboard, fetchLeaderboard)
  components/dashboard/StatsCard.tsx
  components/dashboard/BadgesGrid.tsx
  components/dashboard/LeaderboardTable.tsx
  components/lesson/renderers/BadgeUnlock.tsx
```

### Modified web files

```
  components/layout/AppShell.tsx     (streak indicator in header)
  components/layout/AuthProvider.tsx  (add streak to context, fetch from dashboard/me)
  components/lesson/renderers/CodeExercise.tsx       (show BadgeUnlock on submit)
  components/lesson/renderers/FixBugExercise.tsx      (same)
  components/lesson/renderers/MultipleChoiceExercise.tsx  (same)
  components/lesson/renderers/FillBlankExercise.tsx       (same)
  components/lesson/renderers/PredictOutputExercise.tsx   (same)
```

## Testing

| Layer | Tool | Coverage |
|---|---|---|
| `StreakService` | Jest | 0 attempts → 0; consecutive days → correct count; gap breaks streak; today-only → 1 active; yesterday-only → 1 not active; multiple attempts same day count as 1 |
| `BadgeService` | Jest (mocked repos) | Each of 8 badges: condition met → awarded; not met → not; already earned → not re-awarded; returns newly awarded list |
| `badge.repository` | Jest | Create, findByStudent, unique constraint prevents duplicates |
| `LeaderboardController` | Jest + supertest | Ranked list; cohort filter; 401 without auth |
| `DashboardController` | Jest + supertest | Streak + badges + rank; 401 without auth; empty state for new user |
| `SubmissionService` integration | Jest | submit returns newBadges when condition met |
| Web `lib/gamification.ts` | Vitest | Mocked fetch for dashboard and leaderboard |
| Dashboard page components | Vitest + RTL | StatsCard renders streak/points/rank; BadgesGrid shows earned/unearned; LeaderboardTable highlights current user |
| BadgeUnlock component | Vitest + RTL | Renders badge name + icon when newBadges is non-empty; renders nothing when empty |
| Playwright | Playwright | Register → submit correct MC → see "First Steps" badge unlock |

## Success criteria

1. After first submission, student sees "🚀 Badge unlocked: First Steps!" in the result panel.
2. Student passes an exercise on first try → "🎯 Badge unlocked: Nailed It!" appears.
3. After 3 consecutive days of submissions, "🔥 On a Roll" badge awarded (testable by manipulating Attempt timestamps in a test).
4. `/dashboard` shows personal streak, earned/unearned badges grid, and leaderboard table.
5. Header shows "🔥 3 | 125 pts" when streak is active.
6. Leaderboard ranks students by total points, highlights current student.
7. `GET /api/dashboard/me` returns streak, badges, rank, totalPoints.
8. `GET /api/leaderboard` returns ranked entries with optional cohort filter.
9. All existing tests pass.

## Architectural decisions

1. **Streaks derived from Attempt timestamps, not stored separately.** No state to maintain, no race conditions, always correct. The query is fast for bootcamp-scale data (tens of students, hundreds of attempts).
2. **Hardcoded badge definitions.** 8 badges is enough for V1. Adding more is a code change, not a DB migration. An admin UI for custom badges would be spec #9-era work if needed.
3. **Synchronous badge check after each submission.** No event bus, no async queue. The overhead is ~3-5ms of DB reads per submission. Simpler to build, debug, and test.
4. **Leaderboard computed on-read, not cached.** For tens of students, summing ExerciseResult rows is instant. A materialized view or Redis cache adds complexity for zero measurable benefit at this scale.
5. **`newBadges` in SubmitResponse.** Inline badge notification in the exercise result area — no modal, no toast, no separate notification system. YAGNI.
