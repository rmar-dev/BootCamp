import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { StreakService } from './streak.service';
import { BadgeRepository } from './badge.repository';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService, MasteryProgress } from './mastery.service';
import { DailyXpService, DailyXp, DAILY_XP_TARGET } from './daily-xp.service';
import { TodayPlanService, TodayPlan } from './today-plan.service';
import { BadgeService, BadgeStatus } from './badge.service';

export type { BadgeStatus } from './badge.service';

export type DashboardResponse = {
  streak: number;
  streakIncrementedToday: boolean;
  badges: BadgeStatus[];
  rank: number | null;
  totalPoints: number;
  pointsEarnedToday: number;
  dailyXp: DailyXp;
  mastery: MasteryProgress;
  todayPlan: TodayPlan | null;
};

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly students: StudentRepository,
    private readonly results: ExerciseResultRepository,
    private readonly badgeService: BadgeService,
    private readonly badgeRepo: BadgeRepository,
    private readonly streak: StreakService,
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly dailyXp: DailyXpService,
    private readonly todayPlan: TodayPlanService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getDashboard(
    @CurrentUser() user: { userId: string },
    @Query('trackId') trackId?: string,
  ): Promise<DashboardResponse> {
    const student = await this.students.findByUserId(user.userId);

    if (!student) {
      // No Student row yet (instructor-only user, or registration mid-flight).
      // Public badges are still meaningful as "achievements you could earn"
      // — list them all as locked.
      const publicBadges = await this.badgeRepo.findAllVisibleToStudent({
        id: '',
        cohortId: null,
        enrolledTrackIds: [],
      });
      return {
        streak: 0,
        streakIncrementedToday: false,
        badges: publicBadges.map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          description: b.description,
          icon: b.icon,
          earned: false,
        })),
        rank: null,
        totalPoints: 0,
        pointsEarnedToday: 0,
        dailyXp: { earned: 0, target: DAILY_XP_TARGET },
        mastery: this.mastery.compute(0),
        todayPlan: null,
      } as DashboardResponse;
    }

    const studentId = student.id;

    // Total points (single aggregation, no N+1)
    const pointsAgg = await this.prisma.exerciseResult.aggregate({
      where: { studentId },
      _sum: { pointsEarned: true },
    });
    const totalPoints = pointsAgg._sum.pointsEarned ?? 0;

    // Streak
    const streakResult = await this.streak.getCurrentStreak(studentId);

    // Badges
    const badges = await this.badgeService.listForStudent(studentId);

    // Rank: single aggregation for all students, no N+1
    const allStudents = await this.students.findAll();
    const allStudentIds = allStudents.map((s) => s.id);
    const allTotals = await this.prisma.exerciseResult.groupBy({
      by: ['studentId'],
      where: { studentId: { in: allStudentIds } },
      _sum: { pointsEarned: true },
    });
    const allPointsMap = new Map(
      allTotals.map((t) => [t.studentId, t._sum.pointsEarned ?? 0]),
    );
    const pointsByStudent = allStudents.map((s) => ({
      id: s.id,
      pts: allPointsMap.get(s.id) ?? 0,
    }));
    pointsByStudent.sort((a, b) => b.pts - a.pts);
    const rankIdx = pointsByStudent.findIndex((s) => s.id === studentId);
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;

    const [dailyXp, todayPlan] = await Promise.all([
      this.dailyXp.compute(studentId),
      this.todayPlan.resolve(studentId, trackId),
    ]);
    const mastery = this.mastery.compute(totalPoints);

    return {
      streak: streakResult.current,
      streakIncrementedToday: streakResult.incrementedToday,
      badges,
      rank,
      totalPoints,
      pointsEarnedToday: dailyXp.earned,
      dailyXp,
      mastery,
      todayPlan,
    };
  }
}
