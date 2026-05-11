type Skill = { trackId: string; title: string; language: 'swift' | 'kotlin'; progressPct: number };

export function SkillsList({ skills }: { skills: ReadonlyArray<Skill> }) {
  if (skills.length === 0) {
    return (
      <div className="card">
        <h3 className="h3" style={{ marginBottom: 16 }}>Skills mastered</h3>
        <p className="muted">No tracks practiced yet — start a lesson to see your skills here.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h3 className="h3" style={{ marginBottom: 16 }}>Skills mastered</h3>
      <div className="stack-tight">
        {skills.map((s) => (
          <div key={s.trackId}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>{s.title}</span>
              <span className="mono muted" style={{ fontSize: 'var(--t-xs)' }}>{s.progressPct}%</span>
            </div>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${s.progressPct}%`,
                  background: s.language === 'swift' ? 'var(--iris-400)' : 'var(--amber-400)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
