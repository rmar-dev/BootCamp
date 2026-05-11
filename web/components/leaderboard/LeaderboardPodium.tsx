import type { LeaderboardEntry } from '@/lib/leaderboard.zod';

export function LeaderboardPodium({ entries }: { entries: ReadonlyArray<LeaderboardEntry> }) {
  if (entries.length === 0) return null;
  const ordered = [entries[1], entries[0], entries[2]].filter((p): p is LeaderboardEntry => Boolean(p));
  const heights = [180, 220, 160];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 16, marginBottom: 32, alignItems: 'end' }}>
      {ordered.map((p, i) => {
        const isFirst = p.rank === 1;
        const avatarSize = isFirst ? 80 : 64;
        const avatarBg = isFirst
          ? 'var(--grad-peacock)'
          : p.language === 'kotlin'
            ? 'var(--amber-400)'
            : p.language === 'swift'
              ? 'var(--iris-400)'
              : 'var(--bg-3)';
        return (
          <div key={p.studentId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              className="avatar avatar-lg"
              data-initials={p.initials}
              aria-label={p.initials}
              style={{ width: avatarSize, height: avatarSize, background: avatarBg, fontSize: isFirst ? 24 : 18 }}
            />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 'var(--t-sm)', color: 'var(--peacock-200)', fontWeight: 700 }}>
                {p.totalPoints.toLocaleString()} XP
              </div>
            </div>
            <div
              style={{
                width: '100%',
                height: heights[i] ?? 160,
                background: isFirst
                  ? 'linear-gradient(180deg, var(--amber-400), color-mix(in oklch, var(--amber-400) 40%, var(--bg-2)))'
                  : 'linear-gradient(180deg, var(--bg-3), var(--bg-2))',
                borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                border: '1px solid var(--line-2)',
                borderBottom: 0,
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-display, var(--font-sans))',
                fontSize: isFirst ? 64 : 48,
                fontWeight: 800,
                color: isFirst ? '#2b1700' : 'var(--text-3)',
              }}
            >
              {p.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
