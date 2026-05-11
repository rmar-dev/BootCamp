'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { LessonBlock } from '@/lib/exercise-payloads';
import {
  createExerciseBlock,
  createExplanationBlock,
  createVideoBlock,
  deleteDraft,
  InstructorSaveError,
  mockSave,
  publishLessonToBackend,
  validateDraft,
  type LessonDraft,
} from '@/lib/builder';
import { Button, Eyebrow, Icon, Menu, Modal, Tabs } from '@/components/ui';
import { BuilderOutline } from './BuilderOutline';
import { BuilderPalette, type PaletteKind } from './BuilderPalette';
import { BuilderMetaForm } from './BuilderMetaForm';
import { BuilderBlockCard } from './BuilderBlockCard';
import { ExplanationEditor, VideoEditor, ExerciseEditor } from './BlockEditors';
import { BuilderInspector } from './BuilderInspector';
import { BuilderPreview } from './BuilderPreview';
import { ImportBlockModal } from './ImportBlockModal';

interface Props {
  initialDraft: LessonDraft;
}

type RightTab = 'inspector' | 'preview';

export function BuilderShell({ initialDraft }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<LessonDraft>(initialDraft);
  const [selectedId, setSelectedId] = useState<string | null>(initialDraft.blocks[0]?.id ?? null);
  const [rightTab, setRightTab] = useState<RightTab>('inspector');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initialDraft.updatedAt);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const issues = useMemo(() => validateDraft(draft), [draft]);

  const blockDomId = (id: string) => `block-${id}`;

  // Used by the outline rail: select the block AND scroll its card into the
  // canvas viewport. Card-self clicks go through plain setSelectedId so
  // clicking inside an already-visible card never causes a jolt.
  const onJumpToBlock = useCallback((id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(blockDomId(id));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);
  const selectedBlock = useMemo(
    () => draft.blocks.find((b) => b.id === selectedId) ?? null,
    [draft.blocks, selectedId],
  );

  // Keep state in sync if the route's draft id changes underneath us (rare,
  // but cheap insurance against stale state on back/forward navigation).
  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const update = useCallback((patch: Partial<LessonDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const onAddBlock = useCallback(
    (payload: PaletteKind, atIndex?: number) => {
      const block: LessonBlock =
        payload.kind === 'explanation'
          ? createExplanationBlock()
          : payload.kind === 'video'
            ? createVideoBlock()
            : createExerciseBlock(payload.type);
      setDraft((d) => {
        const next = [...d.blocks];
        const insertAt = atIndex ?? next.length;
        next.splice(insertAt, 0, block);
        return { ...d, blocks: next };
      });
      setSelectedId(block.id);
    },
    [],
  );

  const onBlockChange = useCallback((next: LessonBlock) => {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === next.id ? next : b)),
    }));
  }, []);

  const onDuplicate = useCallback((id: string) => {
    setDraft((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const original = d.blocks[idx];
      const copy: LessonBlock =
        original.kind === 'explanation'
          ? { ...original, id: `${original.id}_dup_${Date.now()}` }
          : original.kind === 'video'
            ? { ...original, id: `${original.id}_dup_${Date.now()}`, video: { ...original.video } }
            : {
                ...original,
                id: `${original.id}_dup_${Date.now()}`,
                exercise: { ...original.exercise, id: `${original.exercise.id}_dup_${Date.now()}` },
              };
      const next = [...d.blocks];
      next.splice(idx + 1, 0, copy);
      return { ...d, blocks: next };
    });
  }, []);

  const onImportBlocks = useCallback((blocks: LessonBlock[]) => {
    if (blocks.length === 0) return;
    setDraft((d) => ({ ...d, blocks: [...d.blocks, ...blocks] }));
    setSelectedId(blocks[0].id);
  }, []);

  const onDelete = useCallback((id: string) => {
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const onReorder = useCallback((from: number, to: number) => {
    setDraft((d) => {
      const next = [...d.blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...d, blocks: next };
    });
  }, []);

  const onMove = useCallback((id: string, dir: -1 | 1) => {
    setDraft((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= d.blocks.length) return d;
      const next = [...d.blocks];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, blocks: next };
    });
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await mockSave(draft);
      setDraft(saved);
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const onPublish = useCallback(
    async (intent: 'update' | 'new' = 'new') => {
      if (issues.length > 0) return;
      setSaving(true);
      setPublishError(null);
      try {
        // Persist to localStorage first so the UI keeps the latest edits
        // even if the network call fails. Then push to the real backend.
        await mockSave(draft);
        const published = await publishLessonToBackend(draft, intent);
        setDraft(published);
        setSavedAt(published.updatedAt);
      } catch (err) {
        const message =
          err instanceof InstructorSaveError
            ? `Publish failed (${err.status}): ${err.message}`
            : err instanceof Error
              ? `Publish failed: ${err.message}`
              : 'Publish failed.';
        setPublishError(message);
      } finally {
        setSaving(false);
      }
    },
    [draft, issues.length],
  );

  const onConfirmDelete = useCallback(() => {
    deleteDraft(draft.id);
    setConfirmDelete(false);
    router.push('/instructor/builder');
  }, [draft.id, router]);

  return (
    <div className="builder">
      <header className="builder-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Link
            href="/instructor/builder"
            className="btn btn-ghost btn-sm"
            style={{ textDecoration: 'none' }}
          >
            <Icon name="chevL" size={12} />
            Builder
          </Link>
          <span style={{ color: 'var(--text-4)' }}>/</span>
          <span
            style={{
              fontSize: 'var(--t-sm)',
              color: 'var(--text-1)',
              fontWeight: 600,
              maxWidth: 360,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {draft.title || 'Untitled lesson'}
          </span>
          <span className="mono muted" style={{ fontSize: 'var(--t-2xs)' }}>
            {draft.slug}
          </span>
          {draft.forkedFrom && (
            <span
              className="badge badge-iris"
              title={`Forked from "${draft.forkedFrom.title}" v${draft.forkedFrom.version}`}
              style={{ flex: 'none' }}
            >
              Fork v{draft.forkedFrom.version}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="builder-foot-status">
            {saving ? (
              <>Saving…</>
            ) : publishError ? (
              <span style={{ color: 'var(--danger-400)' }} title={publishError}>
                ● {publishError.length > 40 ? publishError.slice(0, 40) + '…' : publishError}
              </span>
            ) : issues.length > 0 ? (
              <span style={{ color: 'var(--danger-400)' }}>
                ● {issues.length} issue{issues.length === 1 ? '' : 's'}
              </span>
            ) : savedAt ? (
              <span style={{ color: 'var(--success-400)' }}>● Saved</span>
            ) : (
              <>Unsaved</>
            )}
          </span>
          <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
            Save draft
          </Button>
          {draft.forkedFrom ? (
            <Menu
              align="end"
              trigger={
                <Button
                  variant="iridescent"
                  size="sm"
                  disabled={saving || issues.length > 0}
                  title={issues.length > 0 ? 'Resolve issues before publishing' : undefined}
                >
                  Publish
                  <Icon name="chevR" size={12} style={{ transform: 'rotate(90deg)' }} />
                </Button>
              }
              items={[
                {
                  label: `Update original (v${draft.forkedFrom.version} → v${draft.forkedFrom.version + 1})`,
                  icon: <Icon name="refresh" size={12} />,
                  onSelect: () => onPublish('update'),
                },
                {
                  label: 'Save as new lesson',
                  icon: <Icon name="plus" size={12} />,
                  onSelect: () => onPublish('new'),
                },
              ]}
            />
          ) : (
            <Button
              variant="iridescent"
              size="sm"
              onClick={() => onPublish('new')}
              disabled={saving || issues.length > 0}
              title={issues.length > 0 ? 'Resolve issues before publishing' : undefined}
            >
              Publish
              <Icon name="arrowR" size={12} />
            </Button>
          )}
        </div>
      </header>
      <div className="builder-grid">
      {/* Left rail */}
      <aside className="builder-rail">
        <header className="builder-rail-head">
          <Eyebrow>Outline</Eyebrow>
          <span className="muted mono" style={{ fontSize: 'var(--t-2xs)' }}>
            {draft.blocks.length} block{draft.blocks.length === 1 ? '' : 's'}
          </span>
        </header>
        <div className="builder-rail-body compact">
          <BuilderOutline
            blocks={draft.blocks}
            selectedId={selectedId}
            onSelect={onJumpToBlock}
            onReorder={onReorder}
          />
          <div style={{ marginTop: 18 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Add block</Eyebrow>
            <BuilderPalette onAdd={(p) => onAddBlock(p)} />
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Icon name="duplicate" size={12} />}
              onClick={() => setImportOpen(true)}
              style={{ marginTop: 8, width: '100%' }}
            >
              Import from another lesson
            </Button>
          </div>
        </div>
      </aside>

      {/* Center canvas */}
      <main className="builder-canvas">
        <BuilderMetaForm draft={draft} onChange={update} />

        {draft.blocks.length === 0 && (
          <div
            style={{
              border: '1px dashed var(--line-2)',
              borderRadius: 'var(--r-lg)',
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-3)',
              fontSize: 'var(--t-sm)',
            }}
          >
            No blocks yet — pick a block from the palette on the left.
          </div>
        )}

        {draft.blocks.map((block, idx) => (
          <div key={block.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <BuilderBlockCard
              block={block}
              domId={blockDomId(block.id)}
              selected={selectedId === block.id}
              onSelect={() => setSelectedId(block.id)}
              onDuplicate={() => onDuplicate(block.id)}
              onDelete={() => onDelete(block.id)}
              onMoveUp={idx > 0 ? () => onMove(block.id, -1) : undefined}
              onMoveDown={idx < draft.blocks.length - 1 ? () => onMove(block.id, 1) : undefined}
            >
              {block.kind === 'explanation' && (
                <ExplanationEditor block={block} onChange={onBlockChange} />
              )}
              {block.kind === 'video' && <VideoEditor block={block} onChange={onBlockChange} />}
              {block.kind === 'exercise' && (
                <ExerciseEditor block={block} onChange={onBlockChange} />
              )}
            </BuilderBlockCard>
            <BlockDivider onPickExplanation={() => onAddBlock({ kind: 'explanation' }, idx + 1)} />
          </div>
        ))}
      </main>

      {/* Right rail */}
      <aside className="builder-rail right">
        <header className="builder-rail-head">
          <Tabs<RightTab>
            value={rightTab}
            onChange={setRightTab}
            options={[
              { value: 'inspector', label: 'Inspector', icon: <Icon name="settings" size={12} /> },
              { value: 'preview', label: 'Preview', icon: <Icon name="eye" size={12} /> },
            ]}
            stretch
          />
        </header>
        <div className="builder-rail-body" style={{ padding: 0 }}>
          {rightTab === 'inspector' ? (
            <BuilderInspector
              draft={draft}
              block={selectedBlock}
              issues={issues}
              onBlockChange={onBlockChange}
            />
          ) : (
            <BuilderPreview block={selectedBlock} />
          )}
        </div>
        <footer className="builder-foot">
          <span className="builder-foot-status">
            {draft.publishedAt ? (
              <span style={{ color: 'var(--success-400)' }}>
                ● Published {new Date(draft.publishedAt).toLocaleDateString()}
                {draft.publishIntent === 'update' && draft.forkedFrom && (
                  <span className="muted" style={{ marginLeft: 6 }}>
                    · update of v{draft.forkedFrom.version}
                  </span>
                )}
                {draft.publishIntent === 'new' && draft.forkedFrom && (
                  <span className="muted" style={{ marginLeft: 6 }}>
                    · saved as new
                  </span>
                )}
              </span>
            ) : (
              <>Local draft</>
            )}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={12} />
            Delete draft
          </Button>
        </footer>
      </aside>
      </div>

      <ImportBlockModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImportBlocks}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this draft?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={onConfirmDelete}>
              Delete draft
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-2)' }}>
          This removes the draft from your browser. Published lessons in the
          backend are not affected.
        </p>
      </Modal>
    </div>
  );
}

function BlockDivider({ onPickExplanation }: { onPickExplanation: () => void }) {
  return (
    <div
      className="block-divider"
      onClick={onPickExplanation}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPickExplanation();
        }
      }}
      aria-label="Add explanation here"
    >
      <span className="block-divider-pill">
        <Icon name="plus" size={10} />
        Add explanation
      </span>
    </div>
  );
}
