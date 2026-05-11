import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { ProgressAggregatorService } from '../progress/progress.service';
import { TrackRepository } from '../content/repositories/track.repository';
import { StreakService } from './streak.service';
import { MasteryService } from './mastery.service';
import { BadgeService, BadgeStatus } from './badge.service';
import { startOfHeatStrip, buildHeatStrip } from './heat-strip.util';

export type ProfileResponse = {
  account: {
    studentId: string;
    name: string;
    email: string;
    createdAt: string;
    level: number;
  };
  trackBadges: Array<{ language: 'swift' | 'kotlin'; trackTitle: string }>;
  kpis: {
    totalPoints: number;
    currentStreak: number;
    badgesEarned: number;
    badgesTotal: number;
  };
  heatStrip: number[];
  skills: Array<{
    trackId: string;
    title: string;
    language: 'swift' | 'kotlin';
    progressPct: number;
  }>;
  badges: BadgeStatus[];
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentRepository,
    private readonly users: UserRepository,
    private readonly progress: ProgressAggregatorService,
    private readonly tracks: TrackRepository,
    private readonly streak: StreakService,
    private readonly mastery: MasteryService,
    private readonly badgeService: BadgeService,
  ) {}

  async composeProfile(studentId: string): Promise<ProfileResponse> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('student not found');
    const user = await this.users.findById(student.userId!);
    if (!user) throw new NotFoundException('user not found');

    // Lifetime XP via direct aggregation (matches dashboard's pattern).
    const lifetimeAgg = await this.prisma.exerciseResult.aggregate({
      where: { studentId },
      _sum: { pointsEarned: true },
    });
    const totalPoints = lifetimeAgg._sum.pointsEarned ?? 0;
    const masteryProgress = this.mastery.compute(totalPoints);
    const streakResult = await this.streak.getCurrentStreak(studentId);
    const badgeStatuses = await this.badgeService.listForStudent(studentId);
    const badgesEarned = badgeStatuses.filter((b) => b.earned).length;

    // Heat strip: union of Attempt + ReviewAttempt over 26 weeks.
    const now = new Date();
    const start = startOfHeatStrip(now);
    const [attempts, reviewAttempts] = await Promise.all([
      this.prisma.attempt.findMany({
        where: { studentId, submittedAt: { gte: start } },
        select: { submittedAt: true },
      }),
      this.prisma.reviewAttempt.findMany({
        where: { studentId, submittedAt: { gte: start } },
        select: { submittedAt: true },
      }),
    ]);
    const heatStrip = buildHeatStrip([...attempts, ...reviewAttempts], start);

    // Skills: one bar per track the student has any attempt on.
    const distinctTrackIds = await this.findTrackIdsWithActivity(studentId);
    const skillsRaw = await Promise.all(
      distinctTrackIds.map(async (trackId) => {
        const track = await this.tracks.findLatestPublished(trackId);
        if (!track) return null;
        const progress = await this.progress.getTrackProgress(
          studentId,
          trackId,
        );
        const lessons = progress?.lessons ?? [];
        const completed = lessons.filter((l) => l.state === 'complete').length;
        const progressPct =
          lessons.length === 0
            ? 0
            : Math.round((completed / lessons.length) * 100);
        return {
          trackId,
          title: track.title,
          language: track.language as 'swift' | 'kotlin',
          progressPct,
        };
      }),
    );
    const skills = skillsRaw
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.progressPct - a.progressPct)
      .slice(0, 6);

    const trackBadges = skills.map((s) => ({
      language: s.language,
      trackTitle: s.title,
    }));

    return {
      account: {
        studentId,
        name: student.name,
        email: student.email,
        createdAt: user.createdAt.toISOString(),
        level: masteryProgress.level,
      },
      trackBadges,
      kpis: {
        totalPoints,
        currentStreak: streakResult.current,
        badgesEarned,
        badgesTotal: badgeStatuses.length,
      },
      heatStrip,
      skills,
      badges: badgeStatuses,
    };
  }

  private async findTrackIdsWithActivity(studentId: string): Promise<string[]> {
    const exerciseIds = (
      await this.prisma.attempt.findMany({
        where: { studentId },
        select: { exerciseId: true },
        distinct: ['exerciseId'],
      })
    ).map((a) => a.exerciseId);
    if (exerciseIds.length === 0) return [];
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    });
    const lessonIds = exercises
      .map((e) => e.lessonId)
      .filter((id): id is string => id !== null && id !== undefined);
    if (lessonIds.length === 0) return [];
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { trackId: true },
      distinct: ['trackId'],
    });
    return lessons
      .map((l) => l.trackId)
      .filter((id): id is string => id !== null && id !== undefined);
  }
}
