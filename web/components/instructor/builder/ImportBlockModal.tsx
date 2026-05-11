'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetchLesson, type LessonResponse } from '@/lib/api';
import {
  fetchTrack,
  fetchTracks,
  type LessonSummary,
  type TrackSummary,
} from '@/lib/tracks';
import { cloneBlock } from '@/lib/builder';
import type { LessonBlock } from '@/lib/exercise-payloads';
import { Badge, Button, EmptyState, Icon, Modal, Select } from '@/components/ui';
import { blockMeta, blockTitle } from './blockMeta';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with deep-copied blocks ready to insert into the current draft. */
  onImport: (blocks: LessonBlock[]) => void;
}

export function ImportBlockModal({ open, onClose, onImport }: Props) {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [trackId, setTrackId] = useState<string>('');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [lessonId, setLessonId] = useState<string>('');
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset every time the modal opens so the previous selection doesn't leak.
  useEffect(() => {
    if (!open) return;
    setTrackId('');
    setLessonId('');
    setLesson(null);
    setPicked(new Set());
    setLoadError(null);
    setBusy(true);
    fetchTracks()
      .then((t) => setTracks(t))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [open]);

  useEffect(() => {
    if (!trackId) {
      setLessons([]);
      return;
    }
    setBusy(true);
    fetchTrack(trackId)
      .then((td) => setLessons(td?.lessons ?? []))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
    setLessonId('');
    setLesson(null);
  }, [trackId]);

  useEffect(() => {
    if (!lessonId) {
      setLesson(null);
      return;
    }
    setBusy(true);
    fetchLesson(lessonId, { mode: 'preview' })
      .then((l) => setLesson(l))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
    setPicked(new Set());
  }, [lessonId]);

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const importable = useMemo(() => {
    if (!lesson) return [];
    return lesson.blocks.filter((b) => picked.has(b.id));
  }, [lesson, picked]);

  const onConfirm = () => {
    if (importable.length === 0) return;
    onImport(importable.map(cloneBlock));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Import blocks from another lesson"
      footer={
        <>
          <span className="muted" style={{ fontSize: 'var(--t-xs)', flex: 1 }}>
            {importable.length === 0
              ? 'Pick at least one block.'
              : `${importable.length} block${importable.length === 1 ? '' : 's'} selected — copies will be inserted at the end of your lesson.`}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="iridescent"
            size="sm"
            onClick={onConfirm}
            disabled={importable.length === 0}
          >
            Import {importable.length > 0 ? `(${importable.length})` : ''}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="field-label">Track</span>
            <Select value={trackId} onChange={(e) => setTrackId(e.target.value)}>
              <option value="">Choose a track…</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.language})
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="field-label">Lesson</span>
            <Select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              disabled={!trackId || lessons.length === 0}
            >
              <option value="">Choose a lesson…</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.position + 1} — {l.title}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {loadError ? (
          <p style={{ color: 'var(--danger-400)', fontSize: 'var(--t-sm)', margin: 0 }}>
            {loadError}
          </p>
        ) : !lesson ? (
          <EmptyState
            icon="book"
            title={busy ? 'Loading…' : 'Pick a track + lesson'}
            description={
              busy ? undefined : 'Then tick the blocks you want to copy into the lesson you are building.'
            }
          />
        ) : (
          <BlockPickList
            blocks={lesson.blocks}
            picked={picked}
            onToggle={togglePick}
          />
        )}
      </div>
    </Modal>
  );
}

function BlockPickList({
  blocks,
  picked,
  onToggle,
}: {
  blocks: LessonBlock[];
  picked: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (blocks.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 'var(--t-sm)' }}>
        This lesson has no blocks.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((b, idx) => {
        const meta = blockMeta(b);
        const isPicked = picked.has(b.id);
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onToggle(b.id)}
              className={'outline-item' + (isPicked ? ' active' : '')}
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={isPicked}
                readOnly
                aria-label={`Pick block ${idx + 1}`}
                style={{ flex: 'none' }}
              />
              <span className="outline-index">{idx + 1}</span>
              <Badge tone={meta.tone}>
                <Icon name={meta.icon} size={11} />
                {meta.label}
              </Badge>
              <span className="outline-title">{blockTitle(b)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
