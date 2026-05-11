import type { LeaderboardEntry } from '@/lib/gamification';
import { Card } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';

type Props = { entries: LeaderboardEntry[]; myStudentId: string };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

// TODO: Sub-project F adds /leaderboard route — wire a "See all" link here when it exists.
export function MiniLeaderboard({ entries, myStudentId }: Props) {
  if (entries.length === 0) {
    return (
      <Card variant="elevated" style={{ marginTop: 8 }}>
        <Heading level="h4" style={{ marginBottom: 14 }}>This week&apos;s leaderboard</Heading>
        <p className="muted">No leaderboard entries yet.</p>
      </Card>
    );
  }
  const top3 = entries.slice(0, 3);
  const me = entries.find((e) => e.studentId === myStudentId);
  const includesMe = top3.some((e) => e.studentId === myStudentId);
  const rows = !includesMe && me ? [...top3, me] : top3;

  return (
    <Card variant="elevated" style={{ marginTop: 8 }}>
      <Heading level="h4" style={{ marginBottom: 14 }}>This week&apos;s leaderboard</Heading>
      <div className="stack stack-tight">
        {rows.map((r) => {
          const isMe = r.studentId === myStudentId;
          const isTop = r.rank === 1;
          return (
            <div key={r.studentId} className={cn('lb-row', isMe && 'you')}>
              <div className={cn('lb-rank', isTop && 'top')}>{r.rank}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar size="sm" initials={initials(r.name)} />
                <span style={{ fontSize: 'var(--t-sm)', fontWeight: isMe ? 600 : 500 }}>
                  {r.name}{isMe ? ' (you)' : ''}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>
                {r.totalPoints.toLocaleString()} XP
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
