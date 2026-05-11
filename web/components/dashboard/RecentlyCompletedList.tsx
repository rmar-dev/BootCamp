import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import { Heading } from '@/components/ui/Heading';
import { Row } from '@/components/ui/Row';
import { Badge } from '@/components/ui/Badge';
import { LessonRow } from './LessonRow';

type Props = {
  track: TrackDetail;
  progress: TrackProgress | undefined;
};

export function RecentlyCompletedList({ track, progress }: Props) {
  const titleById = new Map(track.lessons.map((l) => [l.id, l.title]));
  const completed = (progress?.lessons ?? [])
    .filter((l) => l.state === 'complete' && l.lastAttemptAt !== null)
    .sort((a, b) => Date.parse(b.lastAttemptAt!) - Date.parse(a.lastAttemptAt!))
    .slice(0, 3);

  return (
    <div className="stack" style={{ marginTop: 20 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Heading level="h3">Recently completed</Heading>
        <span className="muted" style={{ fontSize: 'var(--t-sm)' }}>This week</span>
      </Row>
      {completed.length === 0 ? (
        <p className="muted">Nothing completed yet — start with today&apos;s plan.</p>
      ) : (
        <div className="stack stack-tight">
          {completed.map((p) => (
            <LessonRow
              key={p.lessonId}
              icon="check"
              title={titleById.get(p.lessonId) ?? p.lessonId}
              meta="Lesson · completed"
              state="completed"
              href={`/lesson/${p.lessonId}`}
              badge={<Badge tone="success" dot>Done</Badge>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
