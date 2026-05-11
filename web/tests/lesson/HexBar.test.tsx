import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HexBar } from '@/components/ui';

describe('HexBar', () => {
  it('renders one hex per state', () => {
    const { container } = render(<HexBar states={['first_try', 'eventual', 'unattempted']} />);
    expect(container.querySelectorAll('.hex')).toHaveLength(3);
  });

  it('applies the state class to each hex', () => {
    const { container } = render(<HexBar states={['first_try', 'eventual', 'unattempted']} />);
    const hexes = container.querySelectorAll('.hex');
    expect(hexes[0]).toHaveClass('first_try');
    expect(hexes[1]).toHaveClass('eventual');
    expect(hexes[2]).not.toHaveClass('first_try');
    expect(hexes[2]).not.toHaveClass('eventual');
  });

  it('renders an empty hexbar when states is empty', () => {
    const { container } = render(<HexBar states={[]} />);
    expect(container.querySelectorAll('.hex')).toHaveLength(0);
  });

  it('exposes a label for screen readers', () => {
    const { container } = render(<HexBar states={['first_try', 'unattempted']} />);
    const wrapper = container.querySelector('.hexbar');
    expect(wrapper?.getAttribute('aria-label')).toMatch(/1 of 2/);
  });
});
