import Link from 'next/link';
import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import type { TodayPlan } from '@/lib/gamification';
import { Heading } from '@/components/ui/Heading';
import { Row } from '@/components/ui/Row';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { LessonRow } from './LessonRow';

type Props = {
  track: TrackDetail;
  progress: TrackProgress | undefined;
  todayPlan: TodayPlan | null;
  accentColor: string;
};

export function UpNextList({ track, progress, todayPlan, accentColor }: Props) {
  const completedIds = new Set(
    (progress?.lessons ?? []).filter((l) => l.state === 'complete').map((l) => l.lessonId),
  );
  const startIdx = todayPlan
    ? Math.max(0, track.lessons.findIndex((l) => l.id === todayPlan.lessonId))
    : 0;
  const candidates = track.lessons.slice(startIdx).filter((l) => !completedIds.has(l.id)).slice(0, 4);

  return (
    <div className="stack">
      <Row style={{ justifyContent: 'space-between' }}>
        <Heading level="h3">Up next</Heading>
        <Link href="/tracks" className="btn btn-ghost btn-sm">
          View skill tree<Icon name="chevR" size={14} />
        </Link>
      </Row>
      {candidates.length === 0 ? (
        <p className="muted">No upcoming lessons in this track.</p>
      ) : (
        <div className="stack stack-tight">
          {candidates.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              icon={i === 0 ? 'play' : 'book'}
              title={lesson.title}
              meta={`Lesson ${lesson.position} · ${lesson.level}`}
              state={i === 0 ? 'next' : 'queued'}
              href={`/lesson/${lesson.id}`}
              accentColor={i === 0 ? accentColor : undefined}
              badge={i === 0 ? <Badge tone="brand" dot>Next</Badge> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
