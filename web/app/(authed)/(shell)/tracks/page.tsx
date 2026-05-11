'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';
import { fetchTrack, type TrackDetail } from '@/lib/tracks';
import { fetchTrackProgress, type TrackProgress } from '@/lib/progress';
import { chunkLessonsIntoSections } from '@/lib/sections';
import { TreePageHead } from '@/components/tracks/TreePageHead';
import { TreeSection } from '@/components/tracks/TreeSection';
import { TreeSkeleton } from '@/components/tracks/TreeSkeleton';
import type { SkillNodeTint } from '@/components/ui/SkillNode';

function NarrowMain({ children }: { children: React.ReactNode }) {
  return <div className="main-narrow">{children}</div>;
}

function EmptyTrackState() {
  return (
    <div className="card" style={{ padding: 24, marginTop: 32 }}>
      <h2 className="h3" style={{ marginBottom: 8 }}>No active track</h2>
      <p className="muted">Pick a track from the topbar switcher to see your skill tree.</p>
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" style={{ marginTop: 32, padding: 24 }}>
      <h3 className="h3" style={{ marginBottom: 8 }}>Couldn&apos;t load track</h3>
      <p className="muted">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-primary" style={{ marginTop: 16 }}>
        Retry
      </button>
    </div>
  );
}

export default function TracksPage() {
  const router = useRouter();
  const { trackId, loading: trackLoading } = useActiveTrack();
  const [detail, setDetail] = useState<TrackDetail | null>(null);
  const [progress, setProgress] = useState<TrackProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    if (!trackId) {
      setDetail(null);
      setProgress(null);
      return;
    }
    const generation = ++loadGenRef.current;
    setError(null);
    setDetail(null);
    setProgress(null);
    try {
      const [t, p] = await Promise.all([
        fetchTrack(trackId),
        fetchTrackProgress(trackId).catch(() => null),
      ]);
      if (generation !== loadGenRef.current) return; // stale, discard
      if (!t) {
        setError('Track not found');
        return;
      }
      setDetail(t);
      setProgress(p);
    } catch (e) {
      if (generation !== loadGenRef.current) return; // stale, discard
      setError(e instanceof Error ? e.message : 'Failed to load track');
    }
  }, [trackId]);

  useEffect(() => {
    void load();
    return () => {
      loadGenRef.current += 1; // invalidate any in-flight fetch
    };
  }, [load]);

  if (trackLoading || (trackId && !detail && !error)) {
    return <NarrowMain><TreeSkeleton /></NarrowMain>;
  }
  if (!trackLoading && !trackId) {
    return <NarrowMain><EmptyTrackState /></NarrowMain>;
  }
  if (error) {
    return <NarrowMain><InlineError message={error} onRetry={load} /></NarrowMain>;
  }
  // TS narrowing backstop: in practice, the guards above ensure detail is non-null here.
  if (!detail) {
    return <NarrowMain><TreeSkeleton /></NarrowMain>;
  }

  const sections = chunkLessonsIntoSections(detail.title, detail.lessons, progress);
  const totalLessons = detail.lessons.length;
  const completedLessons = sections.reduce(
    (acc, s) => acc + s.nodes.filter((n) => n.state === 'completed').length,
    0,
  );
  const tint: SkillNodeTint =
    detail.language === 'kotlin' ? 'kotlin' :
    detail.language === 'swift'  ? 'swift'  : 'shared';

  return (
    <NarrowMain>
      <TreePageHead
        language={detail.language}
        totalLessons={totalLessons}
        completedLessons={completedLessons}
      />
      {sections.length === 0 ? (
        <p className="muted" style={{ marginTop: 32 }}>No lessons in this track yet.</p>
      ) : (
        <div className="tree-wrap">
          {sections.map((s) => (
            <TreeSection
              key={s.index}
              section={s}
              tint={tint}
              onSelectLesson={(lessonId) => router.push(`/lesson/${lessonId}`)}
            />
          ))}
        </div>
      )}
    </NarrowMain>
  );
}
