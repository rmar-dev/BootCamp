import { Injectable } from '@nestjs/common';
import { AttemptRepository } from '../state/repositories/attempt.repository';
import { PrismaService } from '../prisma/prisma.service';

export type StreakResult = {
  current: number;
  activeToday: boolean;
  incrementedToday: boolean;
};

@Injectable()
export class StreakService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getCurrentStreak(studentId: string): Promise<StreakResult> {
    const [attemptDates, reviewRows] = await Promise.all([
      this.attempts.listSubmissionDatesByStudent(studentId),
      this.prisma.reviewAttempt.findMany({
        where: { studentId },
        select: { submittedAt: true },
      }),
    ]);
    const reviewDates = reviewRows.map((r) => r.submittedAt);
    const dates = [...attemptDates, ...reviewDates];

    if (dates.length === 0) {
      return { current: 0, activeToday: false, incrementedToday: false };
    }

    const uniqueDates = Array.from(
      new Set(dates.map((d) => d.toISOString().slice(0, 10))),
    ).sort((a, b) => (a > b ? -1 : 1));

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayDate = new Date(today);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const mostRecent = uniqueDates[0];
    let activeToday: boolean;
    let startIdx: number;

    if (mostRecent === todayStr) {
      activeToday = true;
      startIdx = 0;
    } else if (mostRecent === yesterdayStr) {
      activeToday = false;
      startIdx = 0;
    } else {
      return { current: 0, activeToday: false, incrementedToday: false };
    }

    let streak = 1;
    for (let i = startIdx + 1; i < uniqueDates.length; i++) {
      const expectedDate = new Date(uniqueDates[i - 1]);
      expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
      const expectedStr = expectedDate.toISOString().slice(0, 10);
      if (uniqueDates[i] === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    return { current: streak, activeToday, incrementedToday: activeToday };
  }
}
