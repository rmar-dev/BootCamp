import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TreeSection } from '@/components/tracks/TreeSection';
import type { TreeSection as TreeSectionData, TreeNode as TreeNodeData } from '@/lib/sections';

function nodeData(overrides: Partial<TreeNodeData> = {}): TreeNodeData {
  return {
    lessonId: 'L1',
    title: 'Lesson 1',
    level: 'foundation',
    state: 'available',
    meta: 'Tap to start',
    ...overrides,
  };
}

function section(overrides: Partial<TreeSectionData> = {}): TreeSectionData {
  return {
    index: 0,
    title: 'Swift · Part 1',
    meta: '6 lessons · ~24 min',
    progressPct: 50,
    done: false,
    locked: false,
    nodes: [nodeData(), nodeData({ lessonId: 'L2', title: 'Lesson 2' })],
    ...overrides,
  };
}

describe('TreeSection', () => {
  it('renders the section title and meta', () => {
    render(<TreeSection section={section()} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Swift · Part 1')).toBeInTheDocument();
    expect(screen.getByText('6 lessons · ~24 min')).toBeInTheDocument();
  });

  it('renders progress bar fill matching progressPct', () => {
    const { container } = render(<TreeSection section={section({ progressPct: 65 })} tint="swift" onSelectLesson={() => {}} />);
    const fill = container.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('65%');
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('section-head icon: book when in progress', () => {
    const { container } = render(<TreeSection section={section({ done: false, locked: false })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="book"]')).toBeInTheDocument();
  });

  it('section-head icon: check when done', () => {
    const { container } = render(<TreeSection section={section({ done: true, locked: false, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="check"]')).toBeInTheDocument();
  });

  it('section-head icon: lock when locked', () => {
    const { container } = render(<TreeSection section={section({ locked: true, progressPct: 0, nodes: [nodeData({ state: 'locked', meta: 'Locked' })] })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('[data-section-head-icon="lock"]')).toBeInTheDocument();
  });

  it('renders one TreeNode per node entry', () => {
    const { container } = render(<TreeSection section={section()} tint="swift" onSelectLesson={() => {}} />);
    const buttons = container.querySelectorAll('button.node');
    expect(buttons).toHaveLength(2);
  });

  it('renders milestone row when NOT locked', () => {
    const { container } = render(<TreeSection section={section({ locked: false })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('.medal')).toBeInTheDocument();
  });

  it('does NOT render milestone row when locked', () => {
    const { container } = render(<TreeSection section={section({ locked: true, progressPct: 0, nodes: [nodeData({ state: 'locked' })] })} tint="swift" onSelectLesson={() => {}} />);
    expect(container.querySelector('.medal')).toBeNull();
  });

  it('milestone copy is "Section badge" when not done', () => {
    render(<TreeSection section={section({ done: false, progressPct: 50 })} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Section badge')).toBeInTheDocument();
  });

  it('milestone copy is "Badge earned" when done', () => {
    render(<TreeSection section={section({ done: true, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    expect(screen.getByText('Badge earned')).toBeInTheDocument();
  });

  it('trophy element is decorative (aria-hidden)', () => {
    const { container } = render(<TreeSection section={section({ done: true, progressPct: 100 })} tint="swift" onSelectLesson={() => {}} />);
    const medal = container.querySelector('.medal');
    expect(medal?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the tint to the .tree-track', () => {
    const { container } = render(<TreeSection section={section()} tint="kotlin" onSelectLesson={() => {}} />);
    expect(container.querySelector('.tree-track.tint-kotlin')).toBeInTheDocument();
  });
});
