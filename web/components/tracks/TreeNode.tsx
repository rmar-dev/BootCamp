'use client';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SkillNode, type SkillNodeTint } from '@/components/ui/SkillNode';
import type { TreeNode as TreeNodeData } from '@/lib/sections';

const ICON_FOR_STATE: Record<TreeNodeData['state'], IconName> = {
  completed: 'check',
  current: 'play',
  available: 'play',
  locked: 'lock',
};

const ICON_SIZE_FOR_STATE: Record<TreeNodeData['state'], number> = {
  completed: 24,
  current: 20,
  available: 20,
  locked: 20,
};

export type TreeNodeProps = {
  node: TreeNodeData;
  index: number;
  tint: SkillNodeTint;
  onSelect: (lessonId: string) => void;
};

export function TreeNode({ node, index, tint, onSelect }: TreeNodeProps) {
  const offset = (index % 2 === 0 ? -90 : 90) + Math.sin(index) * 20;
  return (
    <div className="tree-row">
      <div
        style={{
          transform: `translateX(${offset}px)`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <SkillNode
          state={node.state}
          tint={tint}
          onClick={() => onSelect(node.lessonId)}
          aria-label={node.title}
        >
          <Icon name={ICON_FOR_STATE[node.state]} size={ICON_SIZE_FOR_STATE[node.state]} />
        </SkillNode>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>{node.title}</div>
          <div className="mono muted" style={{ fontSize: 'var(--t-2xs)', marginTop: 2 }}>
            {node.meta}
          </div>
        </div>
      </div>
    </div>
  );
}
