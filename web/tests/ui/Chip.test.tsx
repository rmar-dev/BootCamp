import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from '@/components/ui/Chip';

describe('Chip', () => {
  it('emits .chip by default', () => {
    render(<Chip>x</Chip>);
    expect(screen.getByText('x')).toHaveClass('chip');
  });
  it('active adds .active', () => {
    render(<Chip active>x</Chip>);
    expect(screen.getByText('x')).toHaveClass('active');
  });
});
