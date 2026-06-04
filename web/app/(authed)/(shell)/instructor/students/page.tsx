'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  assignStudent,
  fetchRoster,
  fetchUnassigned,
  type RosterEntry,
  type Student,
} from '@/lib/students';
import { createInvitation } from '@/lib/invitations';
import { InvitationCard } from '@/components/invitations/InvitationCard';
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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteIssued, setInviteIssued] = useState<{ link: string; email: string; name: string; expiresAt: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

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

  const onInvite = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setInviteError('');
      setInviting(true);
      try {
        const res = await createInvitation(inviteEmail, inviteName, 'student');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setInviteIssued({
          link: `${origin}${res.acceptUrlPath}`,
          email: inviteEmail,
          name: inviteName,
          expiresAt: res.invitation.expiresAt,
        });
        setInviteEmail('');
        setInviteName('');
        await refresh();
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : 'Could not create invitation');
      } finally {
        setInviting(false);
      }
    },
    [inviteEmail, inviteName, refresh],
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

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Invite a student</h2>
        <form onSubmit={onInvite} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <input type="text" required placeholder="Student name" value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input type="email" required placeholder="student@example.com" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          {inviteError && <p role="alert" className="text-xs text-red-600">{inviteError}</p>}
          <button type="submit" disabled={inviting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-gray-300">
            {inviting ? 'Creating…' : 'Create invitation'}
          </button>
        </form>
        {inviteIssued && (
          <InvitationCard email={inviteIssued.email} name={inviteIssued.name} link={inviteIssued.link} expiresAt={inviteIssued.expiresAt} />
        )}
      </section>

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
