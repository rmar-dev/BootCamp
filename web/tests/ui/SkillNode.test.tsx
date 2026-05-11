import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SkillNode } from '@/components/ui/SkillNode';

describe('SkillNode', () => {
  it.each([
    ['completed', 'completed'],
    ['current', 'current'],
    ['available', 'available'],
    ['locked', 'locked'],
  ] as const)('state="%s" adds .%s class', (state, klass) => {
    const { container } = render(<SkillNode state={state} />);
    expect(container.firstChild).toHaveClass('node', klass);
  });
  it.each([
    ['swift', 'tint-swift'],
    ['kotlin', 'tint-kotlin'],
    ['shared', 'tint-shared'],
  ] as const)('tint="%s" adds .%s class', (tint, klass) => {
    const { container } = render(<SkillNode tint={tint} state="available" />);
    expect(container.firstChild).toHaveClass(klass);
  });
});
