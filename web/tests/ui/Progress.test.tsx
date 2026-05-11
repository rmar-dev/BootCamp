import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';

describe('ProgressBar', () => {
  it('renders .bar with .bar-fill at the requested percentage', () => {
    const { container } = render(<ProgressBar value={42} />);
    expect(container.firstChild).toHaveClass('bar');
    const fill = container.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('42%');
  });
  it('thickness="thin" adds .bar-thin', () => {
    const { container } = render(<ProgressBar value={0} thickness="thin" />);
    expect(container.firstChild).toHaveClass('bar-thin');
  });
  it('clamps value to [0,100]', () => {
    const { container, rerender } = render(<ProgressBar value={-50} />);
    expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('0%');
    rerender(<ProgressBar value={250} />);
    expect((container.querySelector('.bar-fill') as HTMLElement).style.width).toBe('100%');
  });
});

describe('ProgressRing', () => {
  it('renders a .ring with --p custom property', () => {
    const { container } = render(<ProgressRing value={75} />);
    expect(container.firstChild).toHaveClass('ring');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--p')).toBe('75');
  });
});
