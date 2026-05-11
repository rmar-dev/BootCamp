import { Injectable } from '@nestjs/common';

export type MasteryProgress = {
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
};

@Injectable()
export class MasteryService {
  /** Triangular cumulative: sum of 100, 200, 300, ... for the first L-1 levels. */
  static xpForLevelStart(level: number): number {
    return (100 * level * (level - 1)) / 2;
  }

  compute(totalPoints: number): MasteryProgress {
    const safe = Math.max(0, Math.floor(totalPoints));
    let level = 1;
    while (MasteryService.xpForLevelStart(level + 1) <= safe) level++;
    const xpInLevel = safe - MasteryService.xpForLevelStart(level);
    const xpForNextLevel = MasteryService.xpForLevelStart(level + 1) - safe;
    return { level, xpInLevel, xpForNextLevel };
  }
}
