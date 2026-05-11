import type { TrackSummary } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Row } from '@/components/ui/Row';

type Props = {
  tracks: TrackSummary[];
  progressByTrack: Map<string, TrackProgress | null>;
};

const TRACK_COLOR: Record<string, { tone: 'iris' | 'amber'; cssVar: string }> = {
  swift:  { tone: 'iris',  cssVar: 'var(--iris-400)' },
  kotlin: { tone: 'amber', cssVar: 'var(--amber-400)' },
};

export function PathsList({ tracks, progressByTrack }: Props) {
  return (
    <div className="stack">
      <Heading level="h3">Your paths</Heading>
      <div className="stack stack-tight">
        {tracks.map((t) => {
          const tp = progressByTrack.get(t.id);
          const done = (tp?.lessons ?? []).filter((l) => l.state === 'complete').length;
          const total = t.lessonCount;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const color = TRACK_COLOR[t.language] ?? { tone: 'iris' as const, cssVar: 'var(--peacock-400)' };
          return (
            <Card key={t.id}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <Row style={{ gap: 10 }}>
                  <span
                    data-track-dot={color.tone}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: color.cssVar }}
                  />
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                </Row>
                <span className="mono muted" style={{ fontSize: 'var(--t-xs)' }}>{done}/{total}</span>
              </Row>
              <ProgressBar
                value={pct}
                fillStyle={{ background: `linear-gradient(90deg, ${color.cssVar}, var(--peacock-300))` }}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
