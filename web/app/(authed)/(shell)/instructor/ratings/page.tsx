'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  deleteRating,
  fetchRatings,
  type ProjectRating,
  upsertRating,
} from '@/lib/ratings';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Field,
  Heading,
  Icon,
  Input,
  Select,
  Textarea,
} from '@/components/ui';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProjectRatingsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, loading } = useAuth();

  // attemptId can be deep-linked via ?attempt=, or typed in the field.
  const [attemptId, setAttemptId] = useState<string>(search?.get('attempt') ?? '');
  const [ratings, setRatings] = useState<ProjectRating[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null); // last attemptId we loaded for
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compose / edit form
  const [score, setScore] = useState<number>(4);
  const [comment, setComment] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(
    async (id: string) => {
      setError(null);
      if (!UUID_RE.test(id)) {
        setRatings([]);
        setLoaded(null);
        return;
      }
      try {
        setRatings(await fetchRatings(id));
        setLoaded(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ratings');
      }
    },
    [],
  );

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    setHydrated(true);
    if (attemptId) void refresh(attemptId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  const onLoad = useCallback(() => {
    void refresh(attemptId.trim());
  }, [refresh, attemptId]);

  const onSubmit = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    setSubmitting(true);
    try {
      await upsertRating({
        attemptId: loaded,
        score,
        comment: comment.trim(),
      });
      setComment('');
      setScore(4);
      setEditingId(null);
      await refresh(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }, [loaded, score, comment, refresh]);

  const onEdit = useCallback((r: ProjectRating) => {
    setEditingId(r.id);
    setScore(r.score);
    setComment(r.comment);
  }, []);

  const onCancelEdit = useCallback(() => {
    setEditingId(null);
    setScore(4);
    setComment('');
  }, []);

  const onDelete = useCallback(
    async (id: string) => {
      if (!loaded) return;
      setError(null);
      try {
        await deleteRating(id);
        await refresh(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [loaded, refresh],
  );

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const myRating = user ? ratings.find((r) => r.raterUserId === user.id) : null;
  const otherRatings = user ? ratings.filter((r) => r.raterUserId !== user.id) : ratings;
  const avg =
    ratings.length > 0
      ? Math.round((ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length) * 10) / 10
      : null;

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Project ratings
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          Multi-rater feedback on a capstone / project submission. Your rating
          appears as primary on the student&apos;s view; others are shown alongside.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'end',
          marginBottom: 16,
          maxWidth: 720,
        }}
      >
        <Field
          label="Attempt ID"
          htmlFor="attempt-id"
          help="Paste an attemptId from the review queue or a deep link. Reachable via the Review form's attempt page."
        >
          <Input
            id="attempt-id"
            value={attemptId}
            onChange={(e) => setAttemptId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mono"
          />
        </Field>
        <Button
          variant="primary"
          size="sm"
          onClick={onLoad}
          disabled={!UUID_RE.test(attemptId.trim())}
        >
          Load ratings
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

      {!loaded ? (
        <EmptyState
          icon="star"
          title="No attempt loaded"
          description="Paste an attemptId above to rate it or view existing ratings."
        />
      ) : (
        <>
          {/* ── Aggregate ────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'baseline',
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle, #2a3340)',
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Average
              </div>
              <div style={{ fontSize: 'var(--t-2xl)', fontWeight: 600 }}>
                {avg ?? '—'}{avg != null && ' / 5'}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Raters
              </div>
              <div style={{ fontSize: 'var(--t-2xl)', fontWeight: 600 }}>{ratings.length}</div>
            </div>
          </div>

          {/* ── Compose / edit ──────────────────────────────────── */}
          <section style={{ marginBottom: 24 }}>
            <Eyebrow style={{ marginBottom: 8 }}>
              {editingId ? 'Edit your rating' : myRating ? 'Update your rating' : 'Rate this submission'}
            </Eyebrow>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: 12,
                alignItems: 'start',
              }}
            >
              <Field label="Score" htmlFor="rating-score">
                <Select
                  id="rating-score"
                  value={String(score)}
                  onChange={(e) => setScore(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Comment" htmlFor="rating-comment">
                <Textarea
                  id="rating-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What worked, what to revisit, where the student stood out…"
                />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                  Cancel
                </Button>
              )}
              <Button
                variant="iridescent"
                size="sm"
                onClick={onSubmit}
                disabled={!comment.trim() || submitting}
              >
                {myRating ? 'Update rating' : 'Submit rating'}
              </Button>
            </div>
          </section>

          {/* ── Existing ratings ─────────────────────────────────── */}
          {ratings.length === 0 ? (
            <EmptyState
              icon="star"
              title="No ratings yet"
              description="Be the first instructor to rate this submission."
            />
          ) : (
            <section>
              <Eyebrow style={{ marginBottom: 8 }}>
                {ratings.length} rating{ratings.length === 1 ? '' : 's'}
              </Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {myRating && (
                  <RatingCard
                    rating={myRating}
                    isMine
                    onEdit={() => onEdit(myRating)}
                    onDelete={() => onDelete(myRating.id)}
                  />
                )}
                {otherRatings.map((r) => (
                  <RatingCard key={r.id} rating={r} isMine={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RatingCard({
  rating,
  isMine,
  onEdit,
  onDelete,
}: {
  rating: ProjectRating;
  isMine: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid',
        borderColor: isMine
          ? 'color-mix(in oklch, var(--peacock-400) 50%, transparent)'
          : 'var(--border-subtle, #2a3340)',
        background: isMine
          ? 'color-mix(in oklab, var(--peacock-500, #0e7490) 6%, transparent)'
          : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Badge tone={isMine ? 'brand' : 'default'}>
            {rating.score} / 5
          </Badge>
          <span className="mono" style={{ fontSize: 'var(--t-xs)' }}>
            {isMine ? 'Your rating' : `Rater ${rating.raterUserId.slice(0, 8)}`}
          </span>
          <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
            {new Date(rating.updatedAt).toLocaleString()}
          </span>
        </div>
        {isMine && (
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {onEdit && (
              <Button variant="ghost" size="sm" iconOnly aria-label="Edit" onClick={onEdit}>
                <Icon name="pencil" size={12} />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" iconOnly aria-label="Delete" onClick={onDelete}>
                <Icon name="trash" size={12} />
              </Button>
            )}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 'var(--t-sm)' }}>
        {rating.comment}
      </div>
    </div>
  );
}
