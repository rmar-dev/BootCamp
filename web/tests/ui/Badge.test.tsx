import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('emits .badge by default', () => {
    const { container } = render(<Badge>Day 12</Badge>);
    expect(container.firstChild).toHaveClass('badge');
  });
  it.each([
    ['brand', 'badge-brand'],
    ['iris', 'badge-iris'],
    ['amber', 'badge-amber'],
    ['success', 'badge-success'],
  ] as const)('tone="%s" adds %s class', (tone, klass) => {
    const { container } = render(<Badge tone={tone}>x</Badge>);
    expect(container.firstChild).toHaveClass(klass);
  });
  it('mono adds .badge-mono', () => {
    const { container } = render(<Badge mono>x</Badge>);
    expect(container.firstChild).toHaveClass('badge-mono');
  });
  it('dot renders a .badge-dot span before children', () => {
    const { container } = render(<Badge dot>Done</Badge>);
    expect(container.querySelector('.badge-dot')).not.toBeNull();
  });
});
