export function DashboardSkeleton() {
  return (
    <div className="stack" data-testid="dashboard-skeleton" aria-busy="true">
      <div className="page-head">
        <div>
          <div style={{ width: 220, height: 12, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ width: 320, height: 36, background: 'var(--bg-3)', borderRadius: 6 }} />
        </div>
      </div>
      <div className="daily" style={{ minHeight: 180, opacity: 0.5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, marginTop: 32 }}>
        <div style={{ minHeight: 240, background: 'var(--bg-2)', borderRadius: 8 }} />
        <div style={{ minHeight: 240, background: 'var(--bg-2)', borderRadius: 8 }} />
      </div>
    </div>
  );
}
