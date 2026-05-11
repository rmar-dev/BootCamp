import { deriveInitials } from '@/lib/initials';

type Account = { studentId: string; name: string; email: string; createdAt: string; level: number };
type TrackBadge = { language: 'swift' | 'kotlin'; trackTitle: string };
type KPIs = { totalPoints: number; currentStreak: number; badgesEarned: number; badgesTotal: number };

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export function ProfileHead({
  account, trackBadges, kpis,
}: {
  account: Account;
  trackBadges: ReadonlyArray<TrackBadge>;
  kpis: KPIs;
}) {
  return (
    <div className="profile-head">
      <div className="row" style={{ gap: 24, alignItems: 'center' }}>
        <div className="avatar avatar-lg" style={{ width: 96, height: 96, fontSize: 32 }}>
          {deriveInitials(account.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Member since {formatMonth(account.createdAt)} · Level {account.level}
          </div>
          <h1 className="h-display" style={{ fontSize: 'var(--t-4xl)', marginBottom: 8 }}>{account.name}</h1>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {trackBadges.map((b) => {
              const label = b.language === 'swift' ? 'Swift' : 'Kotlin';
              return (
                <span
                  key={b.trackTitle}
                  className={`badge ${b.language === 'swift' ? 'badge-iris' : 'badge-amber'}`}
                  aria-label={b.trackTitle}
                >
                  <span className="badge-dot" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="row" style={{ gap: 32 }}>
          <div className="kpi"><div className="kpi-label">XP</div><div className="kpi-value mono peacock-text">{kpis.totalPoints.toLocaleString()}</div></div>
          <div className="kpi"><div className="kpi-label">Streak</div><div className="kpi-value mono">{kpis.currentStreak} d</div></div>
          <div className="kpi"><div className="kpi-label">Badges</div><div className="kpi-value mono">{kpis.badgesEarned} / {kpis.badgesTotal}</div></div>
        </div>
      </div>
    </div>
  );
}
