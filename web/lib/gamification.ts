import {
  leaderboardSchema,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardEntry as LeaderboardEntryFull,
} from './leaderboard.zod';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export type BadgeStatus = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
};

export type DailyXp = { earned: number; target: number };
export type MasteryProgress = { level: number; xpInLevel: number; xpForNextLevel: number };

export type TodayPlan = {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackTitle: string;
  title: string;
  position: number;
  estimatedMinutes: number;
  typeLabel: 'Concept + quiz' | 'Code + tests' | 'Concept + code' | 'Capstone';
  recommendationKind: 'continue' | 'concept_gap' | 'first_timer';
  reasonMessage: string;
  conceptHint: string | null;
};

export type DashboardData = {
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

// Mini leaderboard shape — used by the dashboard widget only.
// The canonical F-shape leaderboard uses LeaderboardResponse from leaderboard.zod.ts.
export type LeaderboardEntry = { rank: number; studentId: string; name: string; totalPoints: number; streak: number };
export type LeaderboardData = { entries: LeaderboardEntry[]; myRank: number | null };

// F-shape leaderboard types re-exported for consumers.
export type { LeaderboardPeriod, LeaderboardResponse };
export type { LeaderboardEntryFull as LeaderboardEntryWithLeague };

export async function fetchDashboard(trackId?: string): Promise<DashboardData> {
  const url = trackId
    ? `${BASE}/api/dashboard/me?trackId=${encodeURIComponent(trackId)}`
    : `${BASE}/api/dashboard/me`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`dashboard ${res.status}`);
  return res.json();
}

/** Dashboard mini-widget leaderboard — cohort-scoped, simple shape. */
export async function fetchMiniLeaderboard(cohortId?: string): Promise<LeaderboardData> {
  const url = cohortId ? `${BASE}/api/leaderboard?cohortId=${cohortId}` : `${BASE}/api/leaderboard`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}

/** Full F-shape leaderboard — period-scoped with league, scope, initials, isMe. */
export async function fetchLeaderboard(
  period: LeaderboardPeriod = 'weekly',
  cookieHeader?: string,
): Promise<LeaderboardResponse> {
  const res = await fetch(`${BASE}/api/leaderboard?period=${period}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  if (!res.ok) throw new Error(`fetchLeaderboard: ${res.status}`);
  return leaderboardSchema.parse(await res.json());
}
