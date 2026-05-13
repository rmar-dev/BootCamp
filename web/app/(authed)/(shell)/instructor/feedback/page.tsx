'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  fetchFeedbackInbox,
  setFeedbackStatus,
  type Feedback,
  type FeedbackStatus,
} from '@/lib/feedback';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Icon,
  Textarea,
} from '@/components/ui';

type Tab = 'new' | 'seen' | 'resolved' | 'all';

export default function FeedbackInboxPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('new');
  const [rows, setRows] = useState<Feedback[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchFeedbackInbox());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
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

  const filtered = useMemo(() => {
    if (tab === 'all') return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const counts = useMemo(
    () => ({
      new: rows.filter((r) => r.status === 'new').length,
      seen: rows.filter((r) => r.status === 'seen').length,
      resolved: rows.filter((r) => r.status === 'resolved').length,
      all: rows.length,
    }),
    [rows],
  );

  const onSetStatus = async (id: string, status: FeedbackStatus) => {
    setError(null);
    try {
      await setFeedbackStatus(id, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const onReply = async (id: string) => {
    if (!replyText.trim()) return;
    setError(null);
    try {
      // Reply implies resolved; service stamps replyAt/replyBy server-side.
      await setFeedbackStatus(id, 'resolved', replyText.trim());
      setReplyingTo(null);
      setReplyText('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    }
  };

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div
      data-testid="feedback-inbox"
      style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}
    >
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Feedback inbox
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          {counts.new} new · {counts.seen} seen · {counts.resolved} resolved.
          Per-lesson feedback comes with a rating; general feedback is comment-only.
        </p>
      </header>

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 16 }}>
        {(['new', 'seen', 'resolved', 'all'] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab(t)}
          >
            {t} ({counts[t]})
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

      {filtered.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Nothing to read here"
          description={`No ${tab === 'all' ? '' : tab + ' '}feedback in the inbox right now.`}
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((f) => (
            <li
              key={f.id}
              data-testid="feedback-row"
              data-feedback-id={f.id}
              style={{
                padding: 14,
                border: '1px solid var(--border-subtle, #2a3340)',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <Badge tone={f.lessonId ? 'brand' : 'default'}>
                  {f.lessonId ? 'lesson' : 'general'}
                </Badge>
                {f.rating != null && <span className="mono">{f.rating} ⭐</span>}
                <Badge
                  tone={f.status === 'resolved' ? 'success' : f.status === 'seen' ? 'amber' : 'default'}
                >
                  {f.status}
                </Badge>
                <span className="muted mono" style={{ fontSize: 'var(--t-xs)' }}>
                  student {f.studentId.slice(0, 8)}
                </span>
                <span className="muted" style={{ fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
                  {new Date(f.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--t-sm)' }}>{f.comment}</p>

              {f.instructorReply && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 6,
                    background: 'var(--bg-subtle, #1a202a)',
                    fontSize: 'var(--t-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Icon name="user" size={12} />
                    <strong>Your reply</strong>
                    <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
                      {f.instructorReplyAt && new Date(f.instructorReplyAt).toLocaleString()}
                    </span>
                  </div>
                  {f.instructorReply}
                </div>
              )}

              <div style={{ display: 'inline-flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {f.status === 'new' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSetStatus(f.id, 'seen')}
                    data-testid="mark-seen"
                  >
                    Mark seen
                  </Button>
                )}
                {f.status !== 'resolved' && !f.instructorReply && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSetStatus(f.id, 'resolved')}
                    data-testid="mark-resolved"
                  >
                    Mark resolved (no reply)
                  </Button>
                )}
                {!f.instructorReply && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplyingTo(replyingTo === f.id ? null : f.id);
                      setReplyText('');
                    }}
                    data-testid="reply-toggle"
                  >
                    Reply
                  </Button>
                )}
              </div>

              {replyingTo === f.id && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Reply to the student. This marks the feedback as resolved."
                    aria-label="reply-text"
                  />
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    <Button
                      size="sm"
                      variant="iridescent"
                      onClick={() => onReply(f.id)}
                      disabled={!replyText.trim()}
                      data-testid="send-reply"
                    >
                      Send reply + resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="muted" style={{ marginTop: 24, fontSize: 'var(--t-xs)' }}>
        <Eyebrow>Tip</Eyebrow> Replying automatically marks the feedback as
        resolved. To keep it visible to you without a reply, use “Mark seen”.
      </p>
    </div>
  );
}
