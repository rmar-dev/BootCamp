'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  createDraftLesson,
  deleteDraft,
  forkLessonToDraft,
  listDrafts,
  saveDraft,
  type LessonDraft,
} from '@/lib/builder';
import { fetchTrack, fetchTracks, type LessonSummary, type TrackSummary } from '@/lib/tracks';
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Heading,
  Icon,
  Input,
  Menu,
  SegmentedControl,
} from '@/components/ui';

type Filter = 'all' | 'draft' | 'published';

interface PublishedRow {
  track: TrackSummary;
  lesson: LessonSummary;
}

export default function BuilderIndexPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [drafts, setDrafts] = useState<LessonDraft[]>([]);
  const [published, setPublished] = useState<PublishedRow[]>([]);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    setDrafts(listDrafts());
    setHydrated(true);

    let cancelled = false;
    fetchTracks()
      .then(async (tracks) => {
        const details = await Promise.all(
          tracks.map((t) =>
            fetchTrack(t.id)
              .then((td) => ({ track: t, lessons: td?.lessons ?? [] }))
              .catch(() => ({ track: t, lessons: [] as LessonSummary[] })),
          ),
        );
        if (cancelled) return;
        const flat: PublishedRow[] = [];
        for (const { track, lessons } of details) {
          for (const lesson of lessons) flat.push({ track, lesson });
        }
        setPublished(flat);
      })
      .catch((err) => {
        if (!cancelled) setPublishedError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  const onFork = useCallback(
    async (lessonId: string) => {
      setForkingId(lessonId);
      try {
        const draft = await forkLessonToDraft(lessonId);
        router.push(`/instructor/builder/${draft.id}`);
      } catch (err) {
        setPublishedError(err instanceof Error ? err.message : String(err));
        setForkingId(null);
      }
    },
    [router],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts.filter((d) => {
      if (filter === 'draft' && d.publishedAt) return false;
      if (filter === 'published' && !d.publishedAt) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.slug.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [drafts, filter, query]);

  const onCreate = useCallback(() => {
    const draft = createDraftLesson();
    saveDraft(draft);
    router.push(`/instructor/builder/${draft.id}`);
  }, [router]);

  if (loading || !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 28px 80px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Heading level="h1" style={{ marginBottom: 4 }}>
            Lesson builder
          </Heading>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--t-md)' }}>
            Compose lessons from explanation, video, and exercise blocks.
          </p>
        </div>
        <Button variant="iridescent" leadingIcon={<Icon name="plus" size={14} />} onClick={onCreate}>
          New lesson
        </Button>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'draft', label: 'Drafts' },
            { value: 'published', label: 'Published' },
          ]}
        />
        <div style={{ flex: 1, maxWidth: 320 }}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or slug…"
          />
        </div>
      </div>

      <Eyebrow style={{ marginBottom: 8 }}>Your drafts</Eyebrow>
      {filtered.length === 0 ? (
        <EmptyState
          icon="book"
          title={drafts.length === 0 ? 'No drafts yet' : 'No matches'}
          description={
            drafts.length === 0
              ? 'Create a new lesson, or fork a published one below.'
              : 'Try a different filter or search term.'
          }
          action={
            drafts.length === 0 ? (
              <Button variant="primary" leadingIcon={<Icon name="plus" size={12} />} onClick={onCreate}>
                New lesson
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((d) => (
            <DraftRow
              key={d.id}
              draft={d}
              onOpen={() => router.push(`/instructor/builder/${d.id}`)}
              onDelete={() => {
                deleteDraft(d.id);
                setDrafts(listDrafts());
              }}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 36 }}>
        <Eyebrow style={{ marginBottom: 8 }}>
          Published lessons
          {published.length > 0 && (
            <span className="muted" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
              · fork to edit a copy
            </span>
          )}
        </Eyebrow>
        {publishedError ? (
          <p style={{ color: 'var(--danger-400)', fontSize: 'var(--t-sm)' }}>
            Could not load published lessons: {publishedError}
          </p>
        ) : published.length === 0 ? (
          <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>Loading published lessons…</p>
        ) : (
          <PublishedRows rows={published} onFork={onFork} forkingId={forkingId} query={query} />
        )}
      </div>
    </div>
  );
}

function DraftRow({
  draft,
  onOpen,
  onDelete,
}: {
  draft: LessonDraft;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const exerciseCount = draft.blocks.filter((b) => b.kind === 'exercise').length;
  return (
    <div className="lesson-list-row">
      <Link href={`/instructor/builder/${draft.id}`}>
        <div className="lesson-row-title">{draft.title || 'Untitled lesson'}</div>
        <div className="lesson-row-meta">
          <span>{draft.slug}</span>
          <span>·</span>
          <span>
            {draft.blocks.length} block{draft.blocks.length === 1 ? '' : 's'} · {exerciseCount} ex
          </span>
          {draft.forkedFrom && (
            <>
              <span>·</span>
              <span title={`Forked from "${draft.forkedFrom.title}" v${draft.forkedFrom.version}`}>
                fork v{draft.forkedFrom.version}
              </span>
            </>
          )}
        </div>
      </Link>
      {draft.publishedAt ? (
        <Badge tone="success" dot>Published</Badge>
      ) : (
        <Badge dot>Draft</Badge>
      )}
      <Badge tone="brand">{draft.level}</Badge>
      <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
        {new Date(draft.updatedAt).toLocaleDateString()}
      </span>
      <Menu
        align="end"
        trigger={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Lesson actions"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="dots" size={14} />
          </Button>
        }
        items={[
          { label: 'Open', icon: <Icon name="pencil" size={12} />, onSelect: onOpen },
          'divider',
          { label: 'Delete draft', icon: <Icon name="trash" size={12} />, onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  );
}

function PublishedRows({
  rows,
  onFork,
  forkingId,
  query,
}: {
  rows: PublishedRow[];
  onFork: (lessonId: string) => void;
  forkingId: string | null;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) => r.lesson.title.toLowerCase().includes(q) || r.track.title.toLowerCase().includes(q),
      )
    : rows;

  if (filtered.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>
        No published lessons match your search.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {filtered.map(({ track, lesson }) => (
        <div key={`${track.id}:${lesson.id}`} className="lesson-list-row">
          <div style={{ minWidth: 0 }}>
            <div className="lesson-row-title">{lesson.title}</div>
            <div className="lesson-row-meta">
              <span>{track.title}</span>
              <span>·</span>
              <span>{track.language}</span>
              <span>·</span>
              <span>v{lesson.version}</span>
            </div>
          </div>
          <Badge tone="success" dot>Published</Badge>
          <Badge tone="brand">{lesson.level}</Badge>
          <span className="muted" style={{ fontSize: 'var(--t-xs)' }}>
            #{lesson.position + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="pencil" size={12} />}
            onClick={() => onFork(lesson.id)}
            disabled={forkingId === lesson.id}
          >
            {forkingId === lesson.id ? 'Forking…' : 'Edit copy'}
          </Button>
        </div>
      ))}
    </div>
  );
}

