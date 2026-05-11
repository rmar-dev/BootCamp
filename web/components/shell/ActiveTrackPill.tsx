'use client';
import { Badge } from '@/components/ui/Badge';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';

export function ActiveTrackPill() {
  const { totalPoints } = useAuth();
  const { trackId, tracks } = useActiveTrack();
  const active = tracks.find((t) => t.id === trackId);
  const tone = active?.language === 'kotlin' ? 'amber' : 'iris';
  const label = active?.language === 'kotlin' ? 'Kotlin' : 'Swift';
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)',
        marginBottom: 8,
        background: 'var(--bg-1)',
      }}
    >
      <Eyebrow style={{ marginBottom: 8 }}>Active track</Eyebrow>
      <Row style={{ gap: 10 }}>
        <Badge tone={tone} dot>{label}</Badge>
        <span className="muted mono" style={{ fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
          {totalPoints.toLocaleString()} XP
        </span>
      </Row>
    </div>
  );
}
