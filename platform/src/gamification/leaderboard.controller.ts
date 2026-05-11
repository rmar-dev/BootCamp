import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { StreakService } from './streak.service';
import { MasteryService } from './mastery.service';
import { PrismaService } from '../prisma/prisma.service';
import { parsePeriod, computeWindowStart, LeaderboardPeriod } from './leaderboard-period.util';
import { deriveLeague, LeagueDerivation } from './league.util';

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  name: string;
  initials: string;
  language: 'swift' | 'kotlin' | null;
  totalPoints: number;
  streak: number;
  isMe: boolean;
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myLeague: LeagueDerivation | null;
  scope: 'cohort' | 'global';
  cohortName: string | null;
};

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

@Controller('api/leaderboard')
export class LeaderboardController {
  constructor(
    private readonly students: StudentRepository,
    private readonly results: ExerciseResultRepository,
    private readonly streak: StreakService,
    private readonly mastery: MasteryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getLeaderboard(
    @CurrentUser() user: { userId: string; role: string },
    @Query('period') periodInput?: string,
    @Query('cohortId') cohortIdInput?: string,
  ): Promise<LeaderboardResponse> {
    const period = parsePeriod(periodInput);
    const myStudent = await this.students.findByUserId(user.userId);

    // Resolve scope per the precedence in the spec.
    const { cohortId, scope, cohortName } = await this.resolveScope({
      myStudent,
      role: user.role,
      requestedCohortId: cohortIdInput,
    });

    const allStudents = cohortId
      ? await this.students.findByCohort(cohortId)
      : await this.students.findAll();
    const studentIds = allStudents.map((s) => s.id);

    if (studentIds.length === 0) {
      return { period, entries: [], myRank: null, myLeague: null, scope, cohortName };
    }

    const windowStart = computeWindowStart(period);
    const totals =
      windowStart === null
        ? await this.prisma.exerciseResult.groupBy({
            by: ['studentId'],
            where: { studentId: { in: studentIds } },
            _sum: { pointsEarned: true },
          })
        : await this.prisma.attempt.groupBy({
            by: ['studentId'],
            where: { studentId: { in: studentIds }, submittedAt: { gte: windowStart } },
            _sum: { pointsAwarded: true },
          });

    const pointsMap = new Map<string, number>(
      totals.map((t) => [
        t.studentId,
        (windowStart === null
          ? (t as { _sum: { pointsEarned: number | null } })._sum.pointsEarned
          : (t as { _sum: { pointsAwarded: number | null } })._sum.pointsAwarded) ?? 0,
      ]),
    );

    const myStudentId = myStudent?.id ?? null;
    const entriesUnranked = await Promise.all(
      allStudents.map(async (s) => ({
        studentId: s.id,
        name: s.name,
        initials: deriveInitials(s.name),
        language: null as 'swift' | 'kotlin' | null,
        totalPoints: pointsMap.get(s.id) ?? 0,
        streak: (await this.streak.getCurrentStreak(s.id)).current,
        isMe: s.id === myStudentId,
      })),
    );

    entriesUnranked.sort((a, b) => b.totalPoints - a.totalPoints);
    const limited = entriesUnranked.slice(0, 50);
    const ranked: LeaderboardEntry[] = limited.map((e, i) => ({ ...e, rank: i + 1 }));

    const myRank = myStudentId
      ? (ranked.find((e) => e.studentId === myStudentId)?.rank ?? null)
      : null;

    let myLeague: LeagueDerivation | null = null;
    if (myStudent) {
      const myLifetimeAgg = await this.prisma.exerciseResult.aggregate({
        where: { studentId: myStudent.id },
        _sum: { pointsEarned: true },
      });
      const myLifetime = myLifetimeAgg._sum.pointsEarned ?? 0;
      const myLevel = this.mastery.compute(myLifetime).level;
      myLeague = deriveLeague(myLevel, myLifetime);
    }

    return { period, entries: ranked, myRank, myLeague, scope, cohortName };
  }

  private async resolveScope(opts: {
    myStudent: Awaited<ReturnType<StudentRepository['findByUserId']>>;
    role: string;
    requestedCohortId?: string;
  }): Promise<{ cohortId: string | null; scope: 'cohort' | 'global'; cohortName: string | null }> {
    // 1. Explicit ?cohortId= with access (instructor of that cohort or student of it).
    if (opts.requestedCohortId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: opts.requestedCohortId } });
      if (!cohort) {
        throw new ForbiddenException('You do not have access to this cohort leaderboard');
      }
      const isInstructor =
        cohort.instructorId === opts.myStudent?.userId || opts.role === 'admin';
      const isStudent = opts.myStudent?.cohortId === opts.requestedCohortId;
      if (!isInstructor && !isStudent) {
        throw new ForbiddenException('You do not have access to this cohort leaderboard');
      }
      return { cohortId: cohort.id, scope: 'cohort', cohortName: cohort.name };
    }
    // 2. Auto-scope from authenticated student's cohortId.
    if (opts.myStudent?.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: opts.myStudent.cohortId },
      });
      if (cohort) {
        return { cohortId: cohort.id, scope: 'cohort', cohortName: cohort.name };
      }
    }
    // 3. Global fallback.
    return { cohortId: null, scope: 'global', cohortName: null };
  }
}
