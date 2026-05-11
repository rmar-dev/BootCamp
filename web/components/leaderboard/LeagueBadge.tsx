import type { LeaderboardResponse } from '@/lib/gamification';

export function LeagueBadge({ league }: { league: LeaderboardResponse['myLeague'] | null }) {
  if (!league) return null;
  return (
    <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>
      <span style={{ color: 'var(--peacock-200)' }}>Currently in {league.name}</span>
      {league.nextLeague ? <> · {league.xpToNext.toLocaleString()} XP to {league.nextLeague}</> : null}
    </p>
  );
}
