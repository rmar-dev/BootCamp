import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TreeNode } from '@/components/tracks/TreeNode';
import type { TreeNode as TreeNodeData } from '@/lib/sections';

function node(overrides: Partial<TreeNodeData> = {}): TreeNodeData {
  return {
    lessonId: 'L1',
    title: 'Variables & types',
    level: 'foundation',
    state: 'available',
    meta: 'Tap to start',
    ...overrides,
  };
}

describe('TreeNode', () => {
  it('renders title and meta', () => {
    render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    expect(screen.getByText('Variables & types')).toBeInTheDocument();
    expect(screen.getByText('Tap to start')).toBeInTheDocument();
  });

  it('renders SkillNode with state and tint', () => {
    const { container } = render(<TreeNode node={node({ state: 'completed' })} index={0} tint="kotlin" onSelect={() => {}} />);
    const btn = container.querySelector('button.node');
    expect(btn).toBeInTheDocument();
    expect(btn?.classList.contains('completed')).toBe(true);
    expect(btn?.classList.contains('tint-kotlin')).toBe(true);
  });

  it('fires onSelect with lessonId when state is available', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'available' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('fires onSelect when state is current', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'current' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('fires onSelect when state is completed (review)', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'completed' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('L1');
  });

  it('does NOT fire onSelect when state is locked (button is disabled)', () => {
    const onSelect = vi.fn();
    render(<TreeNode node={node({ state: 'locked' })} index={0} tint="swift" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('zigzag offset: even index → -90 + sin(0)*20 = -90', () => {
    const { container } = render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    const inner = container.querySelector('.tree-row > div') as HTMLElement;
    expect(inner.style.transform).toBe('translateX(-90px)');
  });

  it('zigzag offset: odd index → +90 + sin(1)*20 ≈ 106.83', () => {
    const { container } = render(<TreeNode node={node()} index={1} tint="swift" onSelect={() => {}} />);
    const inner = container.querySelector('.tree-row > div') as HTMLElement;
    const px = parseFloat(inner.style.transform.replace('translateX(', '').replace('px)', ''));
    expect(px).toBeCloseTo(90 + Math.sin(1) * 20, 4);
  });

  it('renders inside a .tree-row container', () => {
    const { container } = render(<TreeNode node={node()} index={0} tint="swift" onSelect={() => {}} />);
    expect(container.querySelector('.tree-row')).toBeInTheDocument();
  });
});
