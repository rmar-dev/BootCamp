import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Divider } from '@/components/ui/Divider';

describe('Heading', () => {
  it('level="display" emits h1 with .h-display', () => {
    render(<Heading level="display">Hi</Heading>);
    expect(screen.getByText('Hi').tagName).toBe('H1');
    expect(screen.getByText('Hi')).toHaveClass('h-display');
  });
  it.each([
    ['h1', 'H1', 'h1'],
    ['h2', 'H2', 'h2'],
    ['h3', 'H3', 'h3'],
    ['h4', 'H4', 'h4'],
  ] as const)('level="%s" emits %s with class .%s', (lvl, tag, klass) => {
    render(<Heading level={lvl as 'h1' | 'h2' | 'h3' | 'h4'}>X</Heading>);
    const node = screen.getByText('X');
    expect(node.tagName).toBe(tag);
    expect(node).toHaveClass(klass);
  });
});

describe('Eyebrow', () => {
  it('renders with .eyebrow class', () => {
    render(<Eyebrow>label</Eyebrow>);
    expect(screen.getByText('label')).toHaveClass('eyebrow');
  });
});

describe('Divider', () => {
  it('renders an hr with .divider', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('hr')).toHaveClass('divider');
  });
});
