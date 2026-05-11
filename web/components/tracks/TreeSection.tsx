'use client';
import type { CSSProperties } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { SkillNodeTint } from '@/components/ui/SkillNode';
import type { TreeSection as TreeSectionData } from '@/lib/sections';
import { TreeNode } from './TreeNode';

function headIconName(s: TreeSectionData): IconName {
  if (s.done) return 'check';
  if (s.locked) return 'lock';
  return 'book';
}

function headIconStyle(s: TreeSectionData): CSSProperties {
  if (s.done) {
    return {
      background: 'color-mix(in oklch, var(--success-400) 22%, var(--bg-2))',
      color: 'var(--success-400)',
      borderColor: 'color-mix(in oklch, var(--success-400) 40%, transparent)',
    };
  }
  if (s.locked) {
    return {
      background: 'var(--bg-2)',
      color: 'var(--text-3)',
      borderColor: 'var(--line-2)',
    };
  }
  return {
    background: 'var(--bg-3)',
    color: 'var(--text-1)',
    borderColor: 'var(--line-2)',
  };
}

export type TreeSectionProps = {
  section: TreeSectionData;
  tint: SkillNodeTint;
  onSelectLesson: (lessonId: string) => void;
};

export function TreeSection({ section, tint, onSelectLesson }: TreeSectionProps) {
  const icon = headIconName(section);
  return (
    <div className="tree-section">
      <div className="tree-section-head">
        <div
          className="lesson-icon"
          data-section-head-icon={icon}
          style={headIconStyle(section)}
        >
          <Icon name={icon} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="h3">{section.title}</h3>
          <div className="muted mono" style={{ fontSize: 'var(--t-xs)', marginTop: 4 }}>
            {section.meta}
          </div>
        </div>
        <div style={{ width: 160 }}>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${section.progressPct}%` }} />
          </div>
          <div
            className="mono muted"
            style={{ fontSize: 'var(--t-xs)', textAlign: 'right', marginTop: 6 }}
          >
            {section.progressPct}%
          </div>
        </div>
      </div>

      <div className={`tree-track tint-${tint}`}>
        {section.nodes.map((n, i) => (
          <TreeNode
            key={n.lessonId}
            node={n}
            index={i}
            tint={tint}
            onSelect={onSelectLesson}
          />
        ))}

        {!section.locked && (
          <div className="tree-row">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                className="medal"
                aria-hidden="true"
                style={section.done ? undefined : { filter: 'grayscale(0.4)', opacity: 0.7 }}
              >
                <Icon name="trophy" size={32} />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 'var(--t-xs)',
                  color: section.done ? 'var(--amber-300)' : 'var(--text-3)',
                }}
              >
                {section.done ? 'Badge earned' : 'Section badge'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
