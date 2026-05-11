'use client';
import type { ReactNode } from 'react';
import type { LessonBlock } from '@/lib/exercise-payloads';
import { Badge, Button, Icon, Menu } from '@/components/ui';
import { blockMeta } from './blockMeta';

interface Props {
  block: LessonBlock;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** DOM id used by the outline to scrollIntoView when an instructor jumps to a block. */
  domId?: string;
  children: ReactNode;
}

export function BuilderBlockCard({
  block,
  selected,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  domId,
  children,
}: Props) {
  const meta = blockMeta(block);
  return (
    <article
      id={domId}
      className={'block-card' + (selected ? ' selected' : '')}
      onClick={onSelect}
      onFocus={onSelect}
      tabIndex={-1}
    >
      <header className="block-card-head">
        <div className="block-card-head-left">
          <Badge tone={meta.tone}>
            <Icon name={meta.icon} size={11} />
            {meta.label}
          </Badge>
        </div>
        <Menu
          align="end"
          trigger={
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Block actions"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="dots" size={14} />
            </Button>
          }
          items={[
            ...(onMoveUp ? [{ label: 'Move up', icon: <Icon name="chevL" size={12} style={{ transform: 'rotate(90deg)' }} />, onSelect: onMoveUp }] : []),
            ...(onMoveDown ? [{ label: 'Move down', icon: <Icon name="chevR" size={12} style={{ transform: 'rotate(90deg)' }} />, onSelect: onMoveDown }] : []),
            'divider' as const,
            { label: 'Duplicate', icon: <Icon name="duplicate" size={12} />, onSelect: onDuplicate },
            { label: 'Delete', icon: <Icon name="trash" size={12} />, onSelect: onDelete, danger: true },
          ]}
        />
      </header>
      <div className="block-card-body">{children}</div>
    </article>
  );
}
