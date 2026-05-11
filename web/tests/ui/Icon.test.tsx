import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from '@/components/ui/Icon';

describe('Icon', () => {
  it('renders an SVG with the requested size', () => {
    const { container } = render(<Icon name="play" size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });

  it('renders nothing visible for unknown names but does not throw', () => {
    const { container } = render(<Icon name={"nope" as never} size={16} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('forwards className', () => {
    const { container } = render(<Icon name="play" className="x" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('x');
  });
});
