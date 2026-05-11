import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HeatStrip } from '@/components/profile/HeatStrip';

describe('HeatStrip', () => {
  it('renders 182 cells', () => {
    const cells = Array.from({ length: 182 }, () => 0);
    const { container } = render(<HeatStrip cells={cells} />);
    expect(container.querySelectorAll('.heat-cell')).toHaveLength(182);
  });

  it('applies heat-N class per cell value', () => {
    const cells = [0, 1, 2, 3, 4, ...Array.from({ length: 177 }, () => 0)];
    const { container } = render(<HeatStrip cells={cells as number[]} />);
    const all = container.querySelectorAll('.heat-cell');
    expect(all[0]).not.toHaveClass('heat-1');
    expect(all[1]).toHaveClass('heat-1');
    expect(all[2]).toHaveClass('heat-2');
    expect(all[3]).toHaveClass('heat-3');
    expect(all[4]).toHaveClass('heat-4');
  });

  it('exposes an aria-label with active-day count', () => {
    const cells = Array.from({ length: 182 }, (_, i) => (i < 30 ? 1 : 0));
    const { container } = render(<HeatStrip cells={cells} />);
    const wrapper = container.querySelector('.heat');
    expect(wrapper?.getAttribute('aria-label')).toMatch(/30 active days/);
  });
});
