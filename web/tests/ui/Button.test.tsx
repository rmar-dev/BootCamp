import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('emits .btn class by default', () => {
    render(<Button>Hi</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn');
  });

  it('adds btn-primary on variant="primary"', () => {
    render(<Button variant="primary">Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });

  it('adds btn-iridescent on variant="iridescent"', () => {
    render(<Button variant="iridescent">Glow</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-iridescent');
  });

  it('adds btn-sm on size="sm"', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');
  });

  it('adds btn-lg on size="lg"', () => {
    render(<Button size="lg">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-lg');
  });

  it('adds btn-icon when iconOnly', () => {
    render(<Button iconOnly aria-label="x">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-icon');
  });

  it('merges user className', () => {
    render(<Button className="extra">x</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn', 'extra');
  });

  it('forwards ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('passes native props (disabled, aria-label) through', () => {
    render(<Button disabled aria-label="lbl">x</Button>);
    const b = screen.getByRole('button');
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-label', 'lbl');
  });
});
