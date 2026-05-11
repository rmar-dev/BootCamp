'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';
import { fetchRecommendation } from '@/lib/recommendation';
import { SidebarNavItem } from './SidebarNavItem';

export function ContinueLessonButton({ active }: { active: boolean }) {
  const { streak } = useAuth();
  const { trackId } = useActiveTrack();
  const [nextLesson, setNextLesson] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!trackId) {
      setNextLesson(null);
      return;
    }
    let alive = true;
    fetchRecommendation(trackId)
      .then((r) => {
        if (!alive) return;
        if (r.lesson) setNextLesson({ id: r.lesson.id, title: r.lesson.title });
        else setNextLesson(null);
      })
      .catch(() => { if (alive) setNextLesson(null); });
    return () => { alive = false; };
  }, [trackId]);

  const badge = streak > 0 ? <Badge tone="brand">Day {streak}</Badge> : null;
  const href = nextLesson ? `/lesson/${nextLesson.id}` : '/tracks';
  const label = nextLesson ? nextLesson.title : 'Continue lesson';
  return (
    <SidebarNavItem
      icon="play"
      label={label}
      href={href}
      active={active}
      badge={badge}
    />
  );
}
