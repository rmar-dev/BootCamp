import type { LeaderboardPeriod, LeaderboardResponse } from '@/lib/gamification';
import { LeagueBadge } from './LeagueBadge';

export function LeaderboardPageHead({
  period, onPeriodChange, myLeague, scope, cohortName,
}: {
  period: LeaderboardPeriod;
  onPeriodChange: (p: LeaderboardPeriod) => void;
  myLeague: LeaderboardResponse['myLeague'] | null;
  scope: 'cohort' | 'global';
  cohortName: string | null;
}) {
  const heading = period === 'weekly' ? 'This week.' : period === 'monthly' ? 'This month.' : 'All-time.';
  const eyebrow = scope === 'cohort' ? `${cohortName ?? 'Cohort'} leaderboard` : 'Showing all students';

  return (
    <div className="page-head">
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>
        <h1 className="h-display">{heading}</h1>
        <LeagueBadge league={myLeague} />
      </div>
      <div className="seg" role="tablist">
        {(['weekly', 'monthly', 'all-time'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`seg-btn${p === period ? ' active' : ''}`}
            onClick={() => onPeriodChange(p)}
          >
            {p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'All-time'}
          </button>
        ))}
      </div>
    </div>
  );
}
