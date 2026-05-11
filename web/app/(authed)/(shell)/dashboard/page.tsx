'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';
import { fetchDashboard, fetchMiniLeaderboard, type DashboardData, type LeaderboardData } from '@/lib/gamification';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import { fetchTrackProgress, type TrackProgress } from '@/lib/progress';
import { PageHead } from '@/components/dashboard/PageHead';
import { DailyStrip } from '@/components/dashboard/DailyStrip';
import { UpNextList } from '@/components/dashboard/UpNextList';
import { RecentlyCompletedList } from '@/components/dashboard/RecentlyCompletedList';
import { PathsList } from '@/components/dashboard/PathsList';
import { MiniLeaderboard } from '@/components/dashboard/MiniLeaderboard';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardError } from '@/components/dashboard/DashboardError';

const ACCENT: Record<string, string> = {
  swift: 'var(--iris-400)',
  kotlin: 'var(--amber-400)',
};

type Bundle = {
  dash: DashboardData;
  lb: LeaderboardData;
  track: TrackDetail;
  progressByTrack: Map<string, TrackProgress | null>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { trackId, tracks, loading: trackLoading } = useActiveTrack();
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!trackId) return;
    setError(null);
    setData(null);
    try {
      const [dash, lb, track, entries] = await Promise.all([
        fetchDashboard(trackId),
        fetchMiniLeaderboard(),
        fetchTrack(trackId),
        Promise.all(tracks.map((t) => fetchTrackProgress(t.id).then((p) => [t.id, p] as const))),
      ]);
      if (!track) throw new Error('Active track not found');
      setData({ dash, lb, track, progressByTrack: new Map(entries) });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [trackId, tracks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (trackLoading || !trackId) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error} onRetry={loadAll} />;
  if (!data || !user) return <DashboardSkeleton />;

  const accent = ACCENT[data.track.language] ?? 'var(--peacock-400)';

  return (
    <>
      <PageHead user={user} dash={data.dash} track={data.track} />
      <DailyStrip dash={data.dash} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, marginTop: 32 }}>
        <div className="stack">
          <UpNextList track={data.track} progress={data.progressByTrack.get(trackId) ?? undefined} todayPlan={data.dash.todayPlan} accentColor={accent} />
          <RecentlyCompletedList track={data.track} progress={data.progressByTrack.get(trackId) ?? undefined} />
        </div>
        <div className="stack">
          <PathsList tracks={tracks} progressByTrack={data.progressByTrack} />
          <MiniLeaderboard entries={data.lb.entries} myStudentId={user.id} />
        </div>
      </div>
    </>
  );
}
