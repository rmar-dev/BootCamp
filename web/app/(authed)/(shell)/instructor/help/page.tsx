'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  appendHelpReply,
  fetchHelpRequest,
  fetchInstructorInbox,
  type HelpRequest,
  type HelpRequestStatus,
  type HelpRequestWithMessages,
  setHelpRequestStatus,
} from '@/lib/help-requests';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Icon,
  Textarea,
} from '@/components/ui';

const STATUS_FILTERS: Array<{ label: string; value: HelpRequestStatus | 'all' }> = [
  { label: 'Open + answered', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Answered', value: 'answered' },
  { label: 'Resolved', value: 'resolved' },
];

export default function InstructorHelpInboxPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [filter, setFilter] = useState<HelpRequestStatus | 'all'>('all');
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<HelpRequestWithMessages | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setRequests(await fetchInstructorInbox(filter === 'all' ? undefined : filter));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    }
  }, [filter]);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    refresh().finally(() => setHydrated(true));
  }, [user, loading, router, refresh]);

  useEffect(() => {
    if (!openId) {
      setOpenThread(null);
      return;
    }
    let cancelled = false;
    fetchHelpRequest(openId)
      .then((t) => {
        if (cancelled) return;
        setOpenThread(t);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load thread');
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  // Group by studentId for the inbox cards.
  const groupedByStudent = useMemo(() => {
    const map = new Map<string, HelpRequest[]>();
    for (const r of requests) {
      const arr = map.get(r.studentId) ?? [];
      arr.push(r);
      map.set(r.studentId, arr);
    }
    return Array.from(map.entries()).map(([studentId, items]) => ({ studentId, items }));
  }, [requests]);

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
          Help requests
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          {requests.length} request{requests.length === 1 ? '' : 's'} · grouped by student
        </p>
      </header>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 16 }}>
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Inbox column ─────────────────────────────────────── */}
        <div>
          {groupedByStudent.length === 0 ? (
            <EmptyState
              icon="check"
              title="Inbox empty"
              description={
                filter === 'resolved'
                  ? 'No resolved requests yet.'
                  : 'No open or answered requests right now.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groupedByStudent.map(({ studentId, items }) => (
                <section key={studentId}>
                  <Eyebrow style={{ marginBottom: 6 }}>
                    Student
                    <span className="mono" style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                      {studentId.slice(0, 8)}
                    </span>
                    <span className="muted" style={{ marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
                      · {items.length} request{items.length === 1 ? '' : 's'}
                    </span>
                  </Eyebrow>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {items.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="lesson-list-row"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          cursor: 'pointer',
                          gridTemplateColumns: '1fr auto auto',
                          ...(openId === r.id
                            ? {
                                borderColor: 'color-mix(in oklch, var(--peacock-400) 50%, transparent)',
                                background: 'var(--brand-bg)',
                              }
                            : {}),
                        }}
                        onClick={() => setOpenId(r.id)}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div className="lesson-row-title">{r.title}</div>
                          <div className="lesson-row-meta">
                            <span>{r.anchorKind}</span>
                            <span>·</span>
                            <span>{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                        <StatusBadge status={r.status} />
                        <Icon name="arrowR" size={12} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* ── Thread column ────────────────────────────────────── */}
        <div>
          {!openId ? (
            <EmptyState
              icon="bookmark"
              title="Pick a request"
              description="Click a request from the inbox to see its thread and reply."
            />
          ) : !openThread ? (
            <p className="muted">Loading thread…</p>
          ) : (
            <ThreadView
              thread={openThread}
              callerUserId={user?.id ?? ''}
              onRefresh={async () => {
                const next = await fetchHelpRequest(openThread.id);
                setOpenThread(next);
                await refresh();
              }}
              onError={setError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: HelpRequestStatus }) {
  if (status === 'open') return <Badge tone="amber">open</Badge>;
  if (status === 'answered') return <Badge tone="brand">answered</Badge>;
  return <Badge tone="success">resolved</Badge>;
}

function ThreadView({
  thread,
  callerUserId,
  onRefresh,
  onError,
}: {
  thread: HelpRequestWithMessages;
  callerUserId: string;
  onRefresh: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const onSend = useCallback(async () => {
    if (!body.trim() || sending) return;
    onError(null);
    setSending(true);
    try {
      await appendHelpReply(thread.id, body.trim());
      setBody('');
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setSending(false);
    }
  }, [thread.id, body, sending, onRefresh, onError]);

  const onTransition = useCallback(
    async (next: HelpRequestStatus) => {
      onError(null);
      try {
        await setHelpRequestStatus(thread.id, next);
        await onRefresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Status update failed');
      }
    },
    [thread.id, onRefresh, onError],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Heading level="h3" style={{ margin: 0 }}>
            {thread.title}
          </Heading>
          <StatusBadge status={thread.status} />
        </div>
        <p className="muted" style={{ marginTop: 4, fontSize: 'var(--t-sm)' }}>
          Anchored to {thread.anchorKind}
          <span className="mono"> {thread.anchorId.slice(0, 8)}</span>
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {thread.messages.map((m) => (
          <div
            key={m.id}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, #2a3340)',
              background:
                m.authorId === callerUserId
                  ? 'color-mix(in oklab, var(--peacock-500, #0e7490) 8%, transparent)'
                  : 'transparent',
            }}
          >
            <div className="muted" style={{ fontSize: 'var(--t-xs)', marginBottom: 4 }}>
              {m.authorId === callerUserId ? 'You' : `User ${m.authorId.slice(0, 8)}`} ·{' '}
              {new Date(m.createdAt).toLocaleString()}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--t-sm)' }}>{m.body}</div>
          </div>
        ))}
      </div>

      <div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Reply…"
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {thread.status !== 'resolved' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTransition('resolved')}
              >
                Mark resolved
              </Button>
            )}
            {thread.status === 'resolved' && (
              <Button variant="ghost" size="sm" onClick={() => onTransition('open')}>
                Re-open
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onSend}
            disabled={!body.trim() || sending}
            leadingIcon={<Icon name="arrowR" size={12} />}
          >
            Send reply
          </Button>
        </div>
      </div>
    </div>
  );
}
