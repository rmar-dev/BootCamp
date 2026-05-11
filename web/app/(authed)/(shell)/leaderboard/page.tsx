import { cookies } from 'next/headers';
import { fetchLeaderboard } from '@/lib/gamification';
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: { period?: string } }) {
  const valid = ['weekly', 'monthly', 'all-time'] as const;
  type Period = (typeof valid)[number];
  const period: Period = valid.includes(searchParams.period as Period)
    ? (searchParams.period as Period)
    : 'weekly';
  const cookieHeader = cookies().toString();
  const initialData = await fetchLeaderboard(period, cookieHeader);
  return <LeaderboardPage initialData={initialData} />;
}
