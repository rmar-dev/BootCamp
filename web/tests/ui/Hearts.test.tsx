import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Hearts } from '@/components/ui/Hearts';

describe('Hearts', () => {
  it('renders total svg hearts; empty ones get .empty', () => {
    const { container } = render(<Hearts count={3} total={5} />);
    const hearts = container.querySelectorAll('svg.heart');
    expect(hearts.length).toBe(5);
    const empty = container.querySelectorAll('svg.heart.empty');
    expect(empty.length).toBe(2);
  });
  it('aria-label defaults to "Hearts"', () => {
    const { container } = render(<Hearts count={5} />);
    expect(container.firstChild).toHaveAttribute('aria-label', 'Hearts');
  });
});
