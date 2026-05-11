type Badge = {
  id: string; name: string; description: string; icon: string;
  earned: boolean; earnedAt?: string | null | undefined;
};

export function BadgesGrid({ badges }: { badges: ReadonlyArray<Badge> }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 18 }}>
        <h3 className="h3">Badges</h3>
        <span className="muted mono" style={{ fontSize: 'var(--t-xs)' }}>{earned} / {badges.length} earned</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {badges.map((b) => (
          <div key={b.id} className="medal-row" style={{ alignItems: 'flex-start' }}>
            <div className={`medal${b.earned ? '' : ' locked'}`}>
              <span aria-hidden="true">{b.icon}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4, lineHeight: 1.2 }}>{b.name}</div>
              <div className="muted" style={{ fontSize: 'var(--t-sm)', lineHeight: 1.45 }}>{b.description}</div>
              <div
                className="mono"
                style={{ fontSize: 'var(--t-2xs)', color: b.earned ? 'var(--peacock-300)' : 'var(--text-3)', marginTop: 6 }}
              >
                {b.earned ? (
                  <span className="earned-on" aria-label={`Earned ${b.earnedAt ?? ''}`}>
                    <time dateTime={b.earnedAt ?? undefined}>{b.earnedAt ?? ''}</time>
                  </span>
                ) : (
                  'Locked'
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
