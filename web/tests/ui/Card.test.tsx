import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('emits .card by default', () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.firstChild).toHaveClass('card');
  });
  it('adds card-elevated on variant="elevated"', () => {
    const { container } = render(<Card variant="elevated">x</Card>);
    expect(container.firstChild).toHaveClass('card-elevated');
  });
  it('adds card-glow on variant="glow"', () => {
    const { container } = render(<Card variant="glow">x</Card>);
    expect(container.firstChild).toHaveClass('card-glow');
  });
  it('forwards ref', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>x</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
