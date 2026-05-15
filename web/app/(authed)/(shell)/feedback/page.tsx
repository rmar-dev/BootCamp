'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  fetchMyFeedback,
  submitFeedback,
  type Feedback,
} from '@/lib/feedback';
import { fetchTracks, fetchTrack, type LessonSummary, type TrackSummary } from '@/lib/tracks';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Field,
  Heading,
  Icon,
  Select,
  Textarea,
} from '@/components/ui';

// Student feedback page. Two flavours via one form:
//   * Pick a lesson → per-lesson feedback (rating 1-5 required, comment)
//   * Leave the lesson empty → general platform feedback (comment only)
//
// History of your own past submissions is listed below the form so a
// student can confirm something landed and see the instructor's reply.

export default function FeedbackPage() {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [trackId, setTrackId] = useState<string>('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [lessonId, setLessonId] = useState<string>('');
  const [rating, setRating] = useState<number | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState<Feedback[]>([]);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await fetchMyFeedback());
    } catch {
      // History is best-effort — a failed fetch shouldn't block the form.
    }
  }, []);

  useEffect(() => {
    fetchTracks()
      .then((t) => setTracks(t))
      .catch(() => setTracks([]));
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!trackId) {
      setLessons([]);
      setLessonId('');
      return;
    }
    fetchTrack(trackId)
      .then((td) => setLessons(td?.lessons ?? []))
      .catch(() => setLessons([]));
  }, [trackId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!comment.trim()) {
      setError('Please write a comment before submitting.');
      return;
    }
    if (lessonId && rating === '') {
      setError('Per-lesson feedback needs a rating (1–5).');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        lessonId: lessonId || null,
        rating: rating === '' ? null : Number(rating),
        comment: comment.trim(),
      });
      setSuccess(
        lessonId
          ? 'Thanks — your lesson feedback was sent to your instructor.'
          : 'Thanks — your feedback was logged.',
      );
      setComment('');
      setRating('');
      setLessonId('');
      setTrackId('');
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="feedback-page"
      style={{ maxWidth: 720, margin: '0 auto', padding: '32px 28px 80px' }}
    >
      <header style={{ marginBottom: 24 }}>
        <Heading level="h1" style={{ marginBottom: 4 }}>
          Feedback
        </Heading>
        <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
          Tell us how a specific lesson went, or leave general thoughts about
          the platform. Your assigned instructor sees lesson feedback right
          away; general feedback goes to the team.
        </p>
      </header>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field
          label="Track (optional)"
          htmlFor="fb-track"
          help="Leave empty for general feedback."
        >
          <Select
            id="fb-track"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
          >
            <option value="">— general feedback —</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.language})
              </option>
            ))}
          </Select>
        </Field>

        {trackId && (
          <Field
            label="Lesson"
            htmlFor="fb-lesson"
            help="Which lesson is this feedback about?"
          >
            <Select
              id="fb-lesson"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
            >
              <option value="">— pick a lesson —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {lessonId && (
          <Field
            label="Rating (1–5)"
            htmlFor="fb-rating"
            help="Required for per-lesson feedback."
          >
            <div style={{ display: 'inline-flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={rating === n ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRating(n)}
                  aria-label={`rating-${n}`}
                >
                  {n} ⭐
                </Button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Comment" htmlFor="fb-comment">
          <Textarea
            id="fb-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={6}
            placeholder="What worked, what didn't, anything we should know."
          />
        </Field>

        {error && (
          <div
            role="alert"
            data-testid="feedback-error"
            style={{
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
        {success && (
          <div
            role="status"
            data-testid="feedback-success"
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--peacock-500, #0e7490)',
              background: 'color-mix(in oklab, var(--peacock-500, #0e7490) 12%, transparent)',
              fontSize: 'var(--t-sm)',
            }}
          >
            {success}
          </div>
        )}

        <div>
          <Button
            type="submit"
            variant="iridescent"
            disabled={submitting || !comment.trim()}
            data-testid="feedback-submit"
          >
            {submitting ? 'Sending…' : 'Send feedback'}
          </Button>
        </div>
      </form>

      <section style={{ marginTop: 40 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Your past feedback</Eyebrow>
        {history.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title="No feedback yet"
            description="Your submissions will show up here once you send one."
          />
        ) : (
          <ol
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
            data-testid="feedback-history"
          >
            {history.map((f) => (
              <li
                key={f.id}
                style={{
                  padding: 12,
                  border: '1px solid var(--border-subtle, #2a3340)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Badge tone={f.lessonId ? 'brand' : 'default'}>
                    {f.lessonId ? 'lesson' : 'general'}
                  </Badge>
                  {f.rating != null && (
                    <span className="mono">{f.rating} ⭐</span>
                  )}
                  <Badge tone={f.status === 'resolved' ? 'success' : f.status === 'seen' ? 'amber' : 'default'}>
                    {f.status}
                  </Badge>
                  <span className="muted" style={{ fontSize: 'var(--t-xs)', marginLeft: 'auto' }}>
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--t-sm)' }}>{f.comment}</p>
                {f.instructorReply && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      borderRadius: 6,
                      background: 'var(--bg-subtle, #1a202a)',
                      fontSize: 'var(--t-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name="user" size={12} />
                      <strong>Instructor reply</strong>
                    </div>
                    {f.instructorReply}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
