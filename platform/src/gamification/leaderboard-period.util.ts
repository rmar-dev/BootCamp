// src/gamification/leaderboard-period.util.ts
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all-time';

const VALID: ReadonlyArray<LeaderboardPeriod> = ['weekly', 'monthly', 'all-time'];

export function parsePeriod(input: string | undefined): LeaderboardPeriod {
  return VALID.includes(input as LeaderboardPeriod) ? (input as LeaderboardPeriod) : 'weekly';
}

export function computeWindowStart(period: LeaderboardPeriod, now: Date = new Date()): Date | null {
  if (period === 'all-time') return null;
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  }
  // weekly: most recent Monday 00:00 UTC.
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}
