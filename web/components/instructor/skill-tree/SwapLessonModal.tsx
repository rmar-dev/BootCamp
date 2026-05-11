'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchTrack,
  fetchTracks,
  type LessonSummary,
  type TrackSummary,
} from '@/lib/tracks';
import { Badge, Button, EmptyState, Input, Modal } from '@/components/ui';

export interface PickedLesson {
  lesson: LessonSummary;
  track: TrackSummary;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedLesson) => void;
  /** Lesson ids already in the current customised sequence — shown as
   * "in plan" so instructors can avoid duplicates. */
  alreadyInPlan: Set<string>;
}

export function SwapLessonModal({ open, onClose, onPick, alreadyInPlan }: Props) {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [byTrack, setByTrack] = useState<Map<string, LessonSummary[]>>(new Map());
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setError(null);
    fetchTracks()
      .then(async (t) => {
        setTracks(t);
        const map = new Map<string, LessonSummary[]>();
        await Promise.all(
          t.map((track) =>
            fetchTrack(track.id)
              .then((td) => map.set(track.id, td?.lessons ?? []))
              .catch(() => map.set(track.id, [])),
          ),
        );
        setByTrack(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: PickedLesson[] = [];
    for (const track of tracks) {
      for (const lesson of byTrack.get(track.id) ?? []) {
        if (q && !lesson.title.toLowerCase().includes(q) && !track.title.toLowerCase().includes(q)) continue;
        out.push({ track, lesson });
      }
    }
    return out;
  }, [tracks, byTrack, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Swap lesson"
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all tracks…"
        />
        {error ? (
          <p style={{ color: 'var(--danger-400)', fontSize: 'var(--t-sm)' }}>{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="search"
            title={tracks.length === 0 ? 'Loading…' : 'No matches'}
            description={tracks.length === 0 ? undefined : 'Try a different search term.'}
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflow: 'auto' }}>
            {rows.map(({ track, lesson }) => {
              const inPlan = alreadyInPlan.has(lesson.id);
              return (
                <li key={`${track.id}:${lesson.id}`}>
                  <button
                    type="button"
                    className="lesson-list-row"
                    style={{ width: '100%', cursor: 'pointer', gridTemplateColumns: '1fr auto auto' }}
                    onClick={() => {
                      onPick({ track, lesson });
                      onClose();
                    }}
                  >
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div className="lesson-row-title">{lesson.title}</div>
                      <div className="lesson-row-meta">
                        <span>{track.title}</span>
                        <span>·</span>
                        <span>{track.language}</span>
                        <span>·</span>
                        <span>v{lesson.version}</span>
                      </div>
                    </div>
                    {inPlan && <Badge tone="success" dot>In plan</Badge>}
                    <Badge tone="brand">{lesson.level}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
