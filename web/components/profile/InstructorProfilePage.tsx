import type { Badge } from '@/lib/instructor-badges';
import type { RosterEntry } from '@/lib/students';
import type { UserResponse } from '@/lib/auth';

// Server-rendered "profile" view for instructors. Replaces the student
// ProfilePage entirely when role !== 'student' — the student view's heat
// strip / skills / badges grid don't apply (instructors aren't enrolled in a
// track and aren't earning badges themselves), so this surface focuses on
// the instructor's authoring + mentoring footprint.
export function InstructorProfilePage({
  user,
  badges,
  roster,
}: {
  user: UserResponse;
  badges: Badge[];
  roster: RosterEntry[];
}) {
  const openHelp = roster.reduce((acc, s) => acc + s.openHelpRequestCount, 0);
  return (
    <div className="main" style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 className="h1" style={{ margin: 0 }}>{user.name}</h1>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 'var(--t-md)' }}>
          {user.role === 'admin' ? 'Administrator' : 'Instructor'} · {user.email}
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <Stat label="Students assigned" value={roster.length} />
        <Stat label="Open help requests" value={openHelp} />
        <Stat label="Badges authored" value={badges.length} />
      </section>

      <section>
        <h2 className="h3" style={{ marginBottom: 12 }}>Badges you authored</h2>
        {badges.length === 0 ? (
          <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>
            No badges yet — head to <a href="/instructor/badges">Instructor → Badges</a> to create one.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {badges.map((b) => (
              <li
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  border: '1px solid var(--neutral-200, #e5e7eb)',
                  borderRadius: 10,
                }}
              >
                <span style={{ fontSize: 22 }}>{b.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {b.criteriaKind}
                    {b.thresholdValue != null ? ` · ≥ ${b.thresholdValue}` : ''} · scope: {b.scopeKind}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid var(--neutral-200, #e5e7eb)',
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}
