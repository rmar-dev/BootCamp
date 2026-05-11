'use client';
import { useState } from 'react';
import type { LessonBlock } from '@/lib/exercise-payloads';
import { EmptyState, Icon } from '@/components/ui';
import { blockMeta, blockTitle } from './blockMeta';

const TONE_COLOR: Record<string, string> = {
  brand: 'var(--peacock-300)',
  iris: 'var(--iris-300)',
  amber: 'var(--amber-300)',
  success: 'var(--success-400)',
  default: 'var(--text-3)',
};

interface Props {
  blocks: LessonBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}

export function BuilderOutline({ blocks, selectedId, onSelect, onReorder }: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  if (blocks.length === 0) {
    return (
      <EmptyState
        icon="grid"
        title="No blocks yet"
        description="Add a block from the palette below to start building this lesson."
      />
    );
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {blocks.map((block, idx) => {
        const meta = blockMeta(block);
        const isActive = selectedId === block.id;
        const isDragging = draggingIndex === idx;
        const isDropTarget = dropTarget === idx && draggingIndex !== null && draggingIndex !== idx;
        return (
          <li
            key={block.id}
            className={
              'outline-item' +
              (isActive ? ' active' : '') +
              (isDragging ? ' dragging' : '') +
              (isDropTarget ? ' drop-target' : '')
            }
            draggable
            onDragStart={(e) => {
              setDraggingIndex(idx);
              e.dataTransfer.effectAllowed = 'move';
              // setData is required for Firefox to start the drag
              e.dataTransfer.setData('text/plain', String(idx));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTarget(idx);
            }}
            onDragLeave={() => {
              setDropTarget((cur) => (cur === idx ? null : cur));
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingIndex !== null && draggingIndex !== idx) onReorder(draggingIndex, idx);
              setDraggingIndex(null);
              setDropTarget(null);
            }}
            onDragEnd={() => {
              setDraggingIndex(null);
              setDropTarget(null);
            }}
            onClick={() => onSelect(block.id)}
          >
            <span className="outline-handle" aria-hidden>
              <Icon name="drag" size={14} />
            </span>
            <span className="outline-index">{idx + 1}</span>
            <span style={{ color: TONE_COLOR[meta.tone], display: 'inline-flex' }} aria-hidden>
              <Icon name={meta.icon} size={14} />
            </span>
            <span className="outline-title" title={`${meta.label} — ${blockTitle(block)}`}>
              {blockTitle(block)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
