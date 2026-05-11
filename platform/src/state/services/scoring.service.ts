import { Injectable } from '@nestjs/common';
import { ScoringInput } from '../types/scoring.types';

@Injectable()
export class ScoringService {
  computePoints(input: ScoringInput): number {
    if (!input.passed) {
      return 0;
    }
    const { pointsMax, hintsUsedCount, failedAttemptsBefore } = input;
    const raw =
      pointsMax -
      hintsUsedCount * 0.1 * pointsMax -
      failedAttemptsBefore * 0.05 * pointsMax;
    const floor = 0.2 * pointsMax;
    return Math.floor(Math.max(raw, floor));
  }
}
