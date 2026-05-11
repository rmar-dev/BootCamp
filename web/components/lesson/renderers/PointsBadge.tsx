export function PointsBadge({
  passed,
  pointsAwarded,
  totalPoints,
}: {
  passed: boolean;
  pointsAwarded: number;
  totalPoints: number;
}) {
  if (passed) {
    return (
      <span
        className="row"
        style={{ fontSize: 'var(--t-sm)', gap: 8, color: 'var(--text-2)' }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--success-400)',
            boxShadow: '0 0 8px color-mix(in oklch, var(--success-400) 50%, transparent)',
          }}
        />
        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>+{pointsAwarded} points</span>
        <span className="muted">· {totalPoints} total</span>
      </span>
    );
  }
  return (
    <span className="muted" style={{ fontSize: 'var(--t-sm)' }}>
      0 points this attempt · {totalPoints} total
    </span>
  );
}
