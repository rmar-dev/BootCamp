# Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add streaks (consecutive days of submissions), a leaderboard (ranked by points), and 8 achievement badges to the BootCamp platform, with a `/dashboard` page and inline badge unlock notifications.

**Architecture:** New `GamificationModule` computes streaks from Attempt timestamps (derived, not stored), checks 8 hardcoded badge conditions after each submission via `BadgeService`, and exposes leaderboard + dashboard endpoints. `SubmissionService` calls `BadgeService.checkAndAward()` post-submission and adds `newBadges` to the response. Web gains a dashboard page and badge unlock display in renderers.

**Tech Stack:** Backend: NestJS 10, Prisma 5, existing StateModule/ContentModule/AuthModule. Frontend: Next.js 14.

**Repo state:** Platform `master` at `c9f1dba` (133 tests). Web master at `8942eef` (51 tests).

---

## Task 0: Branch + Prisma migration

- [ ] **Step 1: Create branch**

```bash
cd c:/Users/ricma/BootCamp/platform
git checkout master
git checkout -b feat/gamification
```

- [ ] **Step 2: Add StudentBadge to schema**

Add to `prisma/schema.prisma`:

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

- [ ] **Step 3: Run migration**

```bash
docker compose up -d postgres
npx prisma migrate dev --name add-student-badge
npx prisma generate
npm test
```

Expected: all 133 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add StudentBadge entity"
```

---

## Task 1: Badge definitions + BadgeRepository

**Files:**
- Create: `src/gamification/badge.definitions.ts`
- Create: `src/gamification/badge.repository.ts`
- Create: `test/gamification/badge.repository.spec.ts`

- [ ] **Step 1: Create badge definitions**

Create `src/gamification/badge.definitions.ts`:

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

- [ ] **Step 2: Create BadgeRepository**

Create `src/gamification/badge.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { StudentBadge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../shared/ids';

@Injectable()
export class BadgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudent(studentId: string): Promise<StudentBadge[]> {
    return this.prisma.studentBadge.findMany({
      where: { studentId },
      orderBy: { earnedAt: 'asc' },
    });
  }

  async hasBadge(studentId: string, badgeId: string): Promise<boolean> {
    const count = await this.prisma.studentBadge.count({
      where: { studentId, badgeId },
    });
    return count > 0;
  }

  async award(studentId: string, badgeId: string): Promise<StudentBadge> {
    return this.prisma.studentBadge.upsert({
      where: { studentId_badgeId: { studentId, badgeId } },
      create: { id: newId(), studentId, badgeId },
      update: {},
    });
  }
}
```

- [ ] **Step 3: Write test**

Create `test/gamification/badge.repository.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { BadgeRepository } from '../../src/gamification/badge.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('BadgeRepository', () => {
  let prisma: PrismaClient;
  let repo: BadgeRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new BadgeRepository(prisma as any);
  });
  beforeEach(async () => { await resetDb(prisma); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('awards a badge and finds it', async () => {
    const sid = newId();
    await repo.award(sid, 'first_submit');
    const badges = await repo.findByStudent(sid);
    expect(badges).toHaveLength(1);
    expect(badges[0].badgeId).toBe('first_submit');
  });

  it('hasBadge returns true after award', async () => {
    const sid = newId();
    expect(await repo.hasBadge(sid, 'x')).toBe(false);
    await repo.award(sid, 'x');
    expect(await repo.hasBadge(sid, 'x')).toBe(true);
  });

  it('award is idempotent (upsert)', async () => {
    const sid = newId();
    await repo.award(sid, 'dup');
    await repo.award(sid, 'dup');
    const badges = await repo.findByStudent(sid);
    expect(badges).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run tests, commit**

```bash
npx jest badge.repository -i
git add src/gamification/ test/gamification/
git commit -m "feat: add badge definitions and repository"
```

---

## Task 2: StreakService

**Files:**
- Create: `src/gamification/streak.service.ts`
- Create: `test/gamification/streak.service.spec.ts`

The streak is derived from Attempt timestamps. We need a way to get submission dates. Add a method to `AttemptRepository` or use PrismaService directly. Simplest: add `listSubmissionDatesByStudent` to AttemptRepository.

- [ ] **Step 1: Add date listing to AttemptRepository**

Modify `src/state/repositories/attempt.repository.ts` — add:

```ts
async listSubmissionDatesByStudent(studentId: string): Promise<Date[]> {
  const attempts = await this.prisma.attempt.findMany({
    where: { studentId },
    select: { submittedAt: true },
    orderBy: { submittedAt: 'desc' },
  });
  return attempts.map((a) => a.submittedAt);
}
```

- [ ] **Step 2: Write streak test**

Create `test/gamification/streak.service.spec.ts`:

```ts
import { StreakService, StreakResult } from '../../src/gamification/streak.service';

function mockAttemptRepo(dates: Date[]) {
  return {
    listSubmissionDatesByStudent: jest.fn().mockResolvedValue(dates),
  } as any;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('StreakService', () => {
  it('returns 0 for no attempts', async () => {
    const svc = new StreakService(mockAttemptRepo([]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(0);
    expect(result.activeToday).toBe(false);
  });

  it('returns 1 active for today only', async () => {
    const svc = new StreakService(mockAttemptRepo([daysAgo(0)]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(1);
    expect(result.activeToday).toBe(true);
  });

  it('returns 1 not-active for yesterday only', async () => {
    const svc = new StreakService(mockAttemptRepo([daysAgo(1)]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(1);
    expect(result.activeToday).toBe(false);
  });

  it('counts consecutive days', async () => {
    const svc = new StreakService(mockAttemptRepo([
      daysAgo(0), daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(2),
    ]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(3);
    expect(result.activeToday).toBe(true);
  });

  it('breaks on gap', async () => {
    const svc = new StreakService(mockAttemptRepo([
      daysAgo(0), daysAgo(1), daysAgo(3),
    ]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(2);
  });

  it('returns 0 when oldest submission is 3+ days ago with no recent', async () => {
    const svc = new StreakService(mockAttemptRepo([daysAgo(5)]));
    const result = await svc.getCurrentStreak('s1');
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 3: Implement StreakService**

Create `src/gamification/streak.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AttemptRepository } from '../state/repositories/attempt.repository';

export type StreakResult = {
  current: number;
  activeToday: boolean;
};

function toUTCDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class StreakService {
  constructor(private readonly attempts: AttemptRepository) {}

  async getCurrentStreak(studentId: string): Promise<StreakResult> {
    const timestamps = await this.attempts.listSubmissionDatesByStudent(studentId);
    if (timestamps.length === 0) return { current: 0, activeToday: false };

    const uniqueDays = [...new Set(timestamps.map(toUTCDateString))].sort().reverse();
    const today = toUTCDateString(new Date());
    const yesterday = toUTCDateString(new Date(Date.now() - 86_400_000));

    let startIdx: number;
    let activeToday: boolean;

    if (uniqueDays[0] === today) {
      startIdx = 0;
      activeToday = true;
    } else if (uniqueDays[0] === yesterday) {
      startIdx = 0;
      activeToday = false;
    } else {
      return { current: 0, activeToday: false };
    }

    let count = 1;
    for (let i = startIdx + 1; i < uniqueDays.length; i++) {
      const prevDate = new Date(uniqueDays[i - 1] + 'T00:00:00Z');
      const currDate = new Date(uniqueDays[i] + 'T00:00:00Z');
      const diffDays = (prevDate.getTime() - currDate.getTime()) / 86_400_000;
      if (diffDays === 1) {
        count++;
      } else {
        break;
      }
    }

    return { current: count, activeToday };
  }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npx jest streak.service -i
git add src/gamification/streak.service.ts src/state/repositories/attempt.repository.ts test/gamification/streak.service.spec.ts
git commit -m "feat: add streak service derived from attempt timestamps"
```

---

## Task 3: BadgeService

**Files:**
- Create: `src/gamification/badge.service.ts`
- Create: `test/gamification/badge.service.spec.ts`

- [ ] **Step 1: Write the test**

Create `test/gamification/badge.service.spec.ts`:

```ts
import { BadgeService, BadgeCheckContext } from '../../src/gamification/badge.service';

function mockBadgeRepo(earned: Set<string> = new Set()) {
  return {
    hasBadge: jest.fn().mockImplementation(async (_sid: string, bid: string) => earned.has(bid)),
    award: jest.fn().mockImplementation(async (_sid: string, bid: string) => {
      earned.add(bid);
      return { id: 'x', studentId: 'x', badgeId: bid, earnedAt: new Date() };
    }),
  } as any;
}

function mockStreakService(current: number) {
  return { getCurrentStreak: jest.fn().mockResolvedValue({ current, activeToday: true }) } as any;
}

function mockResultRepo(results: Array<{ exerciseId: string; passed: boolean }> = []) {
  return { listByStudent: jest.fn().mockResolvedValue(results) } as any;
}

function mockExerciseRepo(exercises: Array<{ id: string; type: string }> = []) {
  return {
    findByVersion: jest.fn().mockImplementation(async (id: string) =>
      exercises.find((e) => e.id === id) ?? null,
    ),
  } as any;
}

function mockProgressService(completed: boolean = false) {
  return { isLessonCompleted: jest.fn().mockResolvedValue(completed) } as any;
}

const baseContext: BadgeCheckContext = {
  attempt: { failedAttemptsBefore: 0, passed: true } as any,
  exerciseResult: {} as any,
  totalPoints: 50,
  exerciseType: 'code',
  exerciseId: 'ex-1',
  lessonId: 'les-1',
  lessonVersion: 1,
};

describe('BadgeService', () => {
  it('awards first_submit on any submission', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', baseContext);
    expect(awarded.some((b) => b.id === 'first_submit')).toBe(true);
  });

  it('awards first_pass when passed with 0 prior failures', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', {
      ...baseContext,
      attempt: { failedAttemptsBefore: 0, passed: true } as any,
    });
    expect(awarded.some((b) => b.id === 'first_pass')).toBe(true);
  });

  it('does NOT award first_pass when there were prior failures', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', {
      ...baseContext,
      attempt: { failedAttemptsBefore: 2, passed: true } as any,
    });
    expect(awarded.some((b) => b.id === 'first_pass')).toBe(false);
  });

  it('awards streak_3 when streak >= 3', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(3),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', baseContext);
    expect(awarded.some((b) => b.id === 'streak_3')).toBe(true);
  });

  it('awards points_100 when totalPoints >= 100', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', { ...baseContext, totalPoints: 150 });
    expect(awarded.some((b) => b.id === 'points_100')).toBe(true);
  });

  it('does not re-award already earned badge', async () => {
    const repo = mockBadgeRepo(new Set(['first_submit']));
    const svc = new BadgeService(
      repo, mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', baseContext);
    expect(awarded.some((b) => b.id === 'first_submit')).toBe(false);
    expect(repo.award).not.toHaveBeenCalledWith('s1', 'first_submit');
  });

  it('awards perfect_lesson when all exercises in lesson passed', async () => {
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(), mockExerciseRepo(), mockProgressService(true),
    );
    const awarded = await svc.checkAndAward('s1', baseContext);
    expect(awarded.some((b) => b.id === 'perfect_lesson')).toBe(true);
  });

  it('awards all_types when all 5 exercise types passed', async () => {
    const results = [
      { exerciseId: 'e1', passed: true },
      { exerciseId: 'e2', passed: true },
      { exerciseId: 'e3', passed: true },
      { exerciseId: 'e4', passed: true },
      { exerciseId: 'e5', passed: true },
    ];
    const exercises = [
      { id: 'e1', type: 'code' },
      { id: 'e2', type: 'fix_bug' },
      { id: 'e3', type: 'fill_blank' },
      { id: 'e4', type: 'predict_output' },
      { id: 'e5', type: 'multiple_choice' },
    ];
    const svc = new BadgeService(
      mockBadgeRepo(), mockStreakService(0),
      mockResultRepo(results), mockExerciseRepo(exercises), mockProgressService(),
    );
    const awarded = await svc.checkAndAward('s1', baseContext);
    expect(awarded.some((b) => b.id === 'all_types')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement BadgeService**

Create `src/gamification/badge.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Attempt, ExerciseResult } from '@prisma/client';
import { BadgeRepository } from './badge.repository';
import { StreakService } from './streak.service';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { ProgressService } from '../state/services/progress.service';
import { BADGES, BadgeDefinition } from './badge.definitions';

export type BadgeCheckContext = {
  attempt: Attempt;
  exerciseResult: ExerciseResult;
  totalPoints: number;
  exerciseType: string;
  exerciseId: string;
  lessonId: string;
  lessonVersion: number;
};

const ALL_TYPES = new Set(['code', 'fix_bug', 'fill_blank', 'predict_output', 'multiple_choice']);

@Injectable()
export class BadgeService {
  constructor(
    private readonly badges: BadgeRepository,
    private readonly streaks: StreakService,
    private readonly results: ExerciseResultRepository,
    private readonly exercises: ExerciseRepository,
    private readonly progress: ProgressService,
  ) {}

  async checkAndAward(studentId: string, ctx: BadgeCheckContext): Promise<BadgeDefinition[]> {
    const awarded: BadgeDefinition[] = [];

    for (const badge of BADGES) {
      if (await this.badges.hasBadge(studentId, badge.id)) continue;

      let earned = false;
      switch (badge.id) {
        case 'first_submit':
          earned = true;
          break;
        case 'first_pass':
          earned = ctx.attempt.passed && ctx.attempt.failedAttemptsBefore === 0;
          break;
        case 'streak_3': {
          const s = await this.streaks.getCurrentStreak(studentId);
          earned = s.current >= 3;
          break;
        }
        case 'streak_7': {
          const s = await this.streaks.getCurrentStreak(studentId);
          earned = s.current >= 7;
          break;
        }
        case 'all_types': {
          const allResults = await this.results.listByStudent(studentId);
          const passedIds = allResults.filter((r) => r.passed).map((r) => r.exerciseId);
          const types = new Set<string>();
          for (const eid of passedIds) {
            const ex = await this.exercises.findByVersion(eid, 1);
            if (ex) types.add(ex.type);
          }
          earned = ALL_TYPES.size === types.size && [...ALL_TYPES].every((t) => types.has(t));
          break;
        }
        case 'points_100':
          earned = ctx.totalPoints >= 100;
          break;
        case 'points_500':
          earned = ctx.totalPoints >= 500;
          break;
        case 'perfect_lesson': {
          try {
            earned = await this.progress.isLessonCompleted(studentId, ctx.lessonId, ctx.lessonVersion);
          } catch {
            earned = false;
          }
          break;
        }
      }

      if (earned) {
        await this.badges.award(studentId, badge.id);
        awarded.push(badge);
      }
    }

    return awarded;
  }
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx jest badge.service -i
git add src/gamification/badge.service.ts test/gamification/badge.service.spec.ts
git commit -m "feat: add badge service with 8 achievement checks"
```

---

## Task 4: Controllers + GamificationModule + wire into SubmissionService

**Files:**
- Create: `src/gamification/leaderboard.controller.ts`
- Create: `src/gamification/dashboard.controller.ts`
- Create: `src/gamification/gamification.module.ts`
- Modify: `src/app.module.ts`
- Modify: `src/submission/submission.service.ts`
- Modify: `src/submission/submission.module.ts`
- Create: `test/gamification/leaderboard.controller.spec.ts`
- Create: `test/gamification/dashboard.controller.spec.ts`

- [ ] **Step 1: Create LeaderboardController**

Create `src/gamification/leaderboard.controller.ts`:

```ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { StudentRepository } from '../state/repositories/student.repository';
import { StreakService } from './streak.service';

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(
    private readonly results: ExerciseResultRepository,
    private readonly students: StudentRepository,
    private readonly streaks: StreakService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async leaderboard(
    @Query('cohortId') cohortId: string | undefined,
    @CurrentUser() user: { userId: string },
  ) {
    // Get all students (optionally filtered by cohort)
    // For simplicity, query all students and their results
    const allStudents = cohortId
      ? await this.students.findByCohort(cohortId)
      : await this.students.findAll();

    const entries = await Promise.all(
      allStudents.map(async (s) => {
        const studentResults = await this.results.listByStudent(s.id);
        const totalPoints = studentResults.reduce((sum, r) => sum + r.pointsEarned, 0);
        const streak = await this.streaks.getCurrentStreak(s.id);
        return { studentId: s.id, name: s.name, totalPoints, streak: streak.current };
      }),
    );

    entries.sort((a, b) => b.totalPoints - a.totalPoints);
    const ranked = entries.slice(0, 50).map((e, i) => ({ ...e, rank: i + 1 }));

    // Find current user's rank
    const myStudent = await this.students.findByUserId(user.userId);
    let myRank: number | null = null;
    if (myStudent) {
      const idx = entries.findIndex((e) => e.studentId === myStudent.id);
      if (idx >= 0) myRank = idx + 1;
    }

    return { entries: ranked, myRank };
  }
}
```

Note: This needs `StudentRepository.findAll()` and `StudentRepository.findByCohort(cohortId)`. Add these to the existing StudentRepository:

```ts
async findAll(): Promise<Student[]> {
  return this.prisma.student.findMany();
}

async findByCohort(cohortId: string): Promise<Student[]> {
  return this.prisma.student.findMany({ where: { cohortId } });
}
```

- [ ] **Step 2: Create DashboardController**

Create `src/gamification/dashboard.controller.ts`:

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { BadgeRepository } from './badge.repository';
import { StreakService } from './streak.service';
import { BADGES } from './badge.definitions';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly students: StudentRepository,
    private readonly results: ExerciseResultRepository,
    private readonly badges: BadgeRepository,
    private readonly streaks: StreakService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myDashboard(@CurrentUser() user: { userId: string }) {
    const student = await this.students.findByUserId(user.userId);
    if (!student) {
      return {
        streak: { current: 0, activeToday: false },
        badges: [],
        allBadges: BADGES,
        rank: null,
        totalPoints: 0,
      };
    }

    const streak = await this.streaks.getCurrentStreak(student.id);
    const earnedBadges = await this.badges.findByStudent(student.id);
    const allResults = await this.results.listByStudent(student.id);
    const totalPoints = allResults.reduce((sum, r) => sum + r.pointsEarned, 0);

    // Compute rank
    const allStudents = await this.students.findAll();
    const pointsPerStudent = await Promise.all(
      allStudents.map(async (s) => {
        const res = await this.results.listByStudent(s.id);
        return { studentId: s.id, total: res.reduce((sum, r) => sum + r.pointsEarned, 0) };
      }),
    );
    pointsPerStudent.sort((a, b) => b.total - a.total);
    const rank = pointsPerStudent.findIndex((p) => p.studentId === student.id) + 1;

    return {
      streak,
      badges: earnedBadges.map((eb) => {
        const def = BADGES.find((b) => b.id === eb.badgeId);
        return { ...def, earnedAt: eb.earnedAt };
      }),
      allBadges: BADGES,
      rank: rank > 0 ? rank : null,
      totalPoints,
    };
  }
}
```

- [ ] **Step 3: Create GamificationModule**

Create `src/gamification/gamification.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';
import { BadgeRepository } from './badge.repository';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';
import { LeaderboardController } from './leaderboard.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [StateModule, ContentModule, AuthModule],
  controllers: [LeaderboardController, DashboardController],
  providers: [BadgeRepository, BadgeService, StreakService],
  exports: [BadgeService, StreakService, BadgeRepository],
})
export class GamificationModule {}
```

- [ ] **Step 4: Wire into AppModule**

Add `GamificationModule` to `src/app.module.ts` imports.

- [ ] **Step 5: Modify SubmissionService to call BadgeService**

Read `src/submission/submission.service.ts`. After the `recordAttempt` call and totalPoints computation, add:

```ts
// Badge check
const newBadges = await this.badgeService.checkAndAward(studentId, {
  attempt,
  exerciseResult,
  totalPoints,
  exerciseType: payload.type,
  exerciseId: req.exerciseId,
  lessonId: exercise.lessonId,
  lessonVersion: exercise.version,
});
```

Add `newBadges` to the return value:

```ts
return {
  // ... existing fields ...
  newBadges: newBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
};
```

Update `SubmitResponse` type to include `newBadges: Array<{id: string; name: string; icon: string}>`.

Add `BadgeService` to SubmissionService constructor. Update `SubmissionModule` to import `GamificationModule`.

- [ ] **Step 6: Update resetDb to clear StudentBadge**

In `test/helpers/db.ts`, add `await prisma.studentBadge.deleteMany()` to the `resetDb` function (before other deletes, to avoid FK issues — StudentBadge has no FKs but clear it first for safety).

- [ ] **Step 7: Write e2e tests**

Create `test/gamification/leaderboard.controller.spec.ts` and `test/gamification/dashboard.controller.spec.ts` — both use `Test.createTestingModule({imports:[AppModule]})` + DockerRunner mock + cookieParser. 3 tests each: happy path, empty state, 401.

- [ ] **Step 8: Run full suite, commit**

```bash
npm test
git add -A
git commit -m "feat: add gamification module with leaderboard, dashboard, and badge check in submit"
```

---

## Task 5: Web — gamification client + BadgeUnlock + dashboard page

**Files (all in web/):**
- Create: `lib/gamification.ts`
- Create: `components/lesson/renderers/BadgeUnlock.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `components/dashboard/StatsCard.tsx`
- Create: `components/dashboard/BadgesGrid.tsx`
- Create: `components/dashboard/LeaderboardTable.tsx`
- Create: `tests/gamification.test.ts`
- Create: `tests/renderers/BadgeUnlock.test.tsx`

- [ ] **Step 1: Create gamification client**

Create `web/lib/gamification.ts`:

```ts
import type { UserResponse } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export type BadgeDTO = { id: string; name: string; description: string; icon: string; earnedAt?: string };

export type DashboardData = {
  streak: { current: number; activeToday: boolean };
  badges: BadgeDTO[];
  allBadges: BadgeDTO[];
  rank: number | null;
  totalPoints: number;
};

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  totalPoints: number;
  streak: number;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  myRank: number | null;
};

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/api/dashboard/me`, { credentials: 'include' });
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

export async function fetchLeaderboard(cohortId?: string): Promise<LeaderboardData> {
  const url = cohortId ? `${BASE}/api/leaderboard?cohortId=${cohortId}` : `${BASE}/api/leaderboard`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Create BadgeUnlock component**

Create `web/components/lesson/renderers/BadgeUnlock.tsx`:

```tsx
export function BadgeUnlock({ badges }: { badges: Array<{ id: string; name: string; icon: string }> }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="space-y-1">
      {badges.map((b) => (
        <p key={b.id} className="text-sm font-medium text-green-700 dark:text-green-300">
          {b.icon} Badge unlocked: {b.name}!
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard page with subcomponents**

Create `web/components/dashboard/StatsCard.tsx`:

```tsx
export function StatsCard({ streak, totalPoints, rank }: { streak: number; totalPoints: number; rank: number | null }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-3xl font-bold">🔥 {streak}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Day streak</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-3xl font-bold">{totalPoints}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Total points</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <p className="text-3xl font-bold">{rank ? `#${rank}` : '—'}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Global rank</p>
      </div>
    </div>
  );
}
```

Create `web/components/dashboard/BadgesGrid.tsx`:

```tsx
import type { BadgeDTO } from '@/lib/gamification';

export function BadgesGrid({ earned, all }: { earned: BadgeDTO[]; all: BadgeDTO[] }) {
  const earnedIds = new Set(earned.map((b) => b.id));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {all.map((badge) => {
        const isEarned = earnedIds.has(badge.id);
        return (
          <div
            key={badge.id}
            className={
              isEarned
                ? 'rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-800/60 dark:bg-green-950/40'
                : 'rounded-xl border border-gray-200 bg-gray-50 p-4 text-center opacity-50 dark:border-gray-800 dark:bg-gray-900'
            }
          >
            <p className="text-2xl">{badge.icon}</p>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{badge.name}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{badge.description}</p>
          </div>
        );
      })}
    </div>
  );
}
```

Create `web/components/dashboard/LeaderboardTable.tsx`:

```tsx
import type { LeaderboardEntry } from '@/lib/gamification';

export function LeaderboardTable({ entries, myStudentId }: { entries: LeaderboardEntry[]; myStudentId: string | null }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <th className="py-2 pr-2">#</th>
          <th className="py-2">Name</th>
          <th className="py-2 text-right">Points</th>
          <th className="py-2 text-right">Streak</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.studentId}
            className={
              e.studentId === myStudentId
                ? 'bg-blue-50 font-medium dark:bg-blue-950/40'
                : 'border-b border-gray-100 dark:border-gray-800'
            }
          >
            <td className="py-2 pr-2 text-gray-500">{e.rank}</td>
            <td className="py-2 text-gray-900 dark:text-gray-100">{e.name}</td>
            <td className="py-2 text-right">{e.totalPoints}</td>
            <td className="py-2 text-right">{e.streak > 0 ? `🔥 ${e.streak}` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `web/app/dashboard/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { BadgesGrid } from '@/components/dashboard/BadgesGrid';
import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { fetchDashboard, fetchLeaderboard, type DashboardData, type LeaderboardData } from '@/lib/gamification';

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchDashboard().then(setDashboard).catch(() => {});
    fetchLeaderboard().then(setLeaderboard).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <AppShell title="Dashboard">
        <div className="mx-auto max-w-4xl px-6 py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Sign in to see your dashboard.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard">
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-6">
        {dashboard && (
          <>
            <StatsCard streak={dashboard.streak.current} totalPoints={dashboard.totalPoints} rank={dashboard.rank} />
            <section>
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Badges</h2>
              <BadgesGrid earned={dashboard.badges} all={dashboard.allBadges} />
            </section>
          </>
        )}
        {leaderboard && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Leaderboard</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <LeaderboardTable entries={leaderboard.entries} myStudentId={null} />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Write tests**

Create `web/tests/gamification.test.ts` (client test, 2 tests). Create `web/tests/renderers/BadgeUnlock.test.tsx` (2 tests: renders badges, renders nothing when empty).

- [ ] **Step 5: Run tests + build, commit**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
git add -A
git commit -m "feat: add dashboard page, badge unlock, and gamification client"
```

---

## Task 6: Web — Header streak + renderers badge unlock + Playwright

**Files (web/):**
- Modify: `components/layout/AuthProvider.tsx` (add streak to context)
- Modify: `components/layout/AppShell.tsx` (streak indicator)
- Modify: all 5 renderers (show BadgeUnlock on submit)
- Modify: `lib/submit.ts` (SubmitResponse gains newBadges)
- Modify: `tests/e2e/lesson.spec.ts`

- [ ] **Step 1: Update SubmitResponse type**

In `web/lib/submit.ts`, add `newBadges` to the response type:

```ts
export type SubmitResponse = {
  // ... existing fields ...
  newBadges: Array<{ id: string; name: string; icon: string }>;
};
```

Update the synthetic error return to include `newBadges: []`.

- [ ] **Step 2: Update AuthProvider with streak**

Add `streak: number` to the context type. After fetching progress, also fetch dashboard to get streak. Or simpler: just add streak state and update from dashboard fetch on mount.

- [ ] **Step 3: Update AppShell header**

Add streak next to points: when streak > 0, show `🔥 {streak} |` before the points counter.

- [ ] **Step 4: Update all 5 renderers**

Import `BadgeUnlock` from `./BadgeUnlock`. After the PointsBadge in the submit result area, add:

```tsx
{result.newBadges && <BadgeUnlock badges={result.newBadges} />}
```

For Code/FixBug: show BadgeUnlock only when `submitResult` is set (not `runResult`).

- [ ] **Step 5: Add dashboard link to header**

In AppShell, make the "125 pts" text a link to `/dashboard`.

- [ ] **Step 6: Add Playwright smoke**

Append to `tests/e2e/lesson.spec.ts`:

```ts
test.skip('gamification: submit and see badge unlock', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`badge${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Badge Hunter');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');

  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=1');
  await page.getByLabel('Swift').check();
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/badge unlocked/i)).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 7: Run tests + build, commit**

```bash
npm test && npm run build
git add -A
git commit -m "feat: streak in header, badge unlocks in renderers, dashboard link"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run full platform suite**

```bash
cd c:/Users/ricma/BootCamp/platform && npm test
```

- [ ] **Step 2: Run full web suite + build**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

- [ ] **Step 3: Update HANDOVER.md**

Add spec #6 to handover.
