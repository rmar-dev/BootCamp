'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  assignStudent,
  fetchRoster,
  fetchUnassigned,
  type RosterEntry,
  type Student,
} from '@/lib/students';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Icon,
} from '@/components/ui';

type Tab = 'assigned' | 'unassigned';

export default function StudentsRosterPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('assigned');
  const [assigned, setAssigned] = useState<RosterEntry[]>([]);
  const [unassigned, setUnassigned] = useState<Student[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [r, u] = await Promise.all([fetchRoster(), fetchUnassigned()]);
      setAssigned(r);
      setUnassigned(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    refresh().finally(() => setHydrated(true));
  }, [user, loading, router, refresh]);

  const onClaim = useCallback(
    async (studentId: string) => {
      if (!user) return;
      try {
        await assignStudent(studentId, user.id);
        await refresh();
        setTab('assigned');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Claim failed');
      }
    },
    [user, refresh],
  );

  const onRelease = useCallback(
    async (studentId: string) => {
      try {
        await assignStudent(studentId, null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Release failed');
      }
    },
    [refresh],
  );

  const totalOpenHelp = useMemo(
    () => assigned.reduce((acc, s) => acc + s.openHelpRequestCount, 0),
    [assigned],
  );

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Students
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          {assigned.length} assigned · {totalOpenHelp} open help request{totalOpenHelp === 1 ? '' : 's'} · {unassigned.length} unassigned
        </p>
      </header>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 16 }}>
        <Button variant={tab === 'assigned' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('assigned')}>
          Assigned ({assigned.length})
        </Button>
        <Button variant={tab === 'unassigned' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('unassigned')}>
          Unassigned ({unassigned.length})
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--danger-500, #b91c1c)',
            background: 'color-mix(in oklab, var(--danger-500, #b91c1c) 12%, transparent)',
            fontSize: 'var(--t-sm)',
          }}
        >
          {error}
        </div>
      )}

      {tab === 'assigned' ? (
        assigned.length === 0 ? (
          <EmptyState
            icon="user"
            title="No assigned students"
            description="Claim students from the Unassigned tab to get started."
            action={
              <Button variant="primary" size="sm" onClick={() => setTab('unassigned')}>
                Browse unassigned
              </Button>
            }
          />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {assigned.map((s) => (
              <li key={s.id}>
                <div className="lesson-list-row" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
                  <Link
                    href={`/instructor/students/${s.id}`}
                    style={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                  >
                    <div className="lesson-row-title">{s.name}</div>
                    <div className="lesson-row-meta">
                      <span className="truncate">{s.email}</span>
                      {s.cohortId && (
                        <>
                          <span>·</span>
                          <span className="mono">cohort {s.cohortId.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </Link>
                  {s.openHelpRequestCount > 0 && (
                    <Badge tone="amber">
                      {s.openHelpRequestCount} help
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRelease(s.id)}
                    title="Release this student to the unassigned pool"
                  >
                    Release
                  </Button>
                  <Link href={`/instructor/students/${s.id}`}>
                    <Button variant="primary" size="sm" leadingIcon={<Icon name="arrowR" size={12} />}>
                      Open
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )
      ) : unassigned.length === 0 ? (
        <EmptyState
          icon="check"
          title="No unassigned students"
          description="All students have been claimed."
        />
      ) : (
        <>
          <Eyebrow style={{ marginBottom: 8 }}>Available to claim</Eyebrow>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unassigned.map((s) => (
              <li key={s.id}>
                <div className="lesson-list-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="lesson-row-title">{s.name}</div>
                    <div className="lesson-row-meta">
                      <span className="truncate">{s.email}</span>
                      {s.cohortId && (
                        <>
                          <span>·</span>
                          <span className="mono">cohort {s.cohortId.slice(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge tone="default">Unassigned</Badge>
                  <Button variant="primary" size="sm" onClick={() => onClaim(s.id)}>
                    Claim
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
