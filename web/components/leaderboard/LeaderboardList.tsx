import type { LeaderboardEntry } from '@/lib/leaderboard.zod';

export function LeaderboardList({ entries }: { entries: ReadonlyArray<LeaderboardEntry> }) {
  if (entries.length === 0) return null;
  return (
    <div className="card card-elevated">
      <div className="stack-tight">
        {entries.map((r) => (
          <div key={r.studentId} className={`lb-row${r.isMe ? ' you' : ''}`}>
            <div className="lb-rank">{r.rank}</div>
            <div className="row" style={{ gap: 12 }}>
              <div
                className="avatar avatar-sm"
                data-initials={r.initials}
                aria-label={r.initials}
                style={{
                  background: r.language === 'kotlin'
                    ? 'var(--amber-400)'
                    : r.language === 'swift'
                      ? 'var(--iris-400)'
                      : 'var(--bg-3)',
                }}
              />
              <div>
                <div style={{ fontSize: 'var(--t-sm)', fontWeight: r.isMe ? 600 : 500 }}>{r.name}</div>
                <div className="mono muted" style={{ fontSize: 'var(--t-2xs)', marginTop: 2 }}>
                  {r.streak}d streak
                </div>
              </div>
            </div>
            <span className="mono" style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>
              {r.totalPoints.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
