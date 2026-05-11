'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  fetchLeaderboard,
  type LeaderboardPeriod,
  type LeaderboardResponse,
} from '@/lib/gamification';
import { LeaderboardPageHead } from './LeaderboardPageHead';
import { LeaderboardPodium } from './LeaderboardPodium';
import { LeaderboardList } from './LeaderboardList';

const VALID_PERIODS: ReadonlyArray<LeaderboardPeriod> = ['weekly', 'monthly', 'all-time'];

function parsePeriodParam(input: string | null | undefined): LeaderboardPeriod {
  return VALID_PERIODS.includes(input as LeaderboardPeriod) ? (input as LeaderboardPeriod) : 'weekly';
}

export function LeaderboardPage({ initialData }: { initialData: LeaderboardResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const period = parsePeriodParam(params.get('period'));
  const [data, setData] = useState<LeaderboardResponse>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data.period === period) return;
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(period)
      .then((next) => { if (!cancelled) setData(next); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, data.period]);

  const top3 = data.entries.slice(0, 3);
  const rest = data.entries.slice(3);

  return (
    <div className="main main-narrow">
      <LeaderboardPageHead
        period={period}
        onPeriodChange={(p) => router.replace(`?period=${p}`, { scroll: false })}
        myLeague={data.myLeague}
        scope={data.scope}
        cohortName={data.cohortName}
      />
      {loading ? <p className="muted">Loading…</p> : (
        <>
          <LeaderboardPodium entries={top3} />
          <LeaderboardList entries={rest} />
        </>
      )}
    </div>
  );
}
