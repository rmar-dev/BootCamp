import { Injectable } from '@nestjs/common';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';

export const DAILY_XP_TARGET = 20;

export type DailyXp = { earned: number; target: number };

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class DailyXpService {
  constructor(private readonly results: ExerciseResultRepository) {}

  async compute(studentId: string): Promise<DailyXp> {
    const earned = await this.results.sumPointsSince(studentId, startOfUtcDay());
    return { earned, target: DAILY_XP_TARGET };
  }
}
