import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LessonRow } from '@/components/dashboard/LessonRow';

describe('LessonRow', () => {
  it('renders title, meta, and links to href', () => {
    render(<LessonRow icon="play" title="State & bindings" meta="Concept · 6 min" state="next" href="/lesson/L8" />);
    const link = screen.getByRole('link', { name: /State & bindings/ });
    expect(link).toHaveAttribute('href', '/lesson/L8');
    expect(screen.getByText('Concept · 6 min')).toBeInTheDocument();
  });

  it('emits .lesson-row class for queued state', () => {
    const { container } = render(<LessonRow icon="book" title="x" meta="y" state="queued" href="/x" />);
    expect(container.querySelector('a.lesson-row')).toBeInTheDocument();
    expect(container.querySelector('a.lesson-row.completed')).toBeNull();
  });

  it('emits .lesson-row.completed for completed state', () => {
    const { container } = render(<LessonRow icon="check" title="x" meta="y" state="completed" href="/x" />);
    expect(container.querySelector('a.lesson-row.completed')).toBeInTheDocument();
  });

  it('applies accentColor inline style on .lesson-icon when state="next"', () => {
    const { container } = render(<LessonRow icon="play" title="x" meta="y" state="next" href="/x" accentColor="rgb(255, 0, 0)" />);
    const icon = container.querySelector('.lesson-icon') as HTMLElement;
    expect(icon.style.background).toBe('rgb(255, 0, 0)');
    expect(icon.style.borderColor).toBe('rgb(255, 0, 0)');
  });

  it('does NOT apply accentColor when state is not "next"', () => {
    const { container } = render(<LessonRow icon="check" title="x" meta="y" state="completed" href="/x" accentColor="red" />);
    const icon = container.querySelector('.lesson-icon') as HTMLElement;
    expect(icon.style.background).toBe('');
  });

  it('renders the badge slot when provided', () => {
    render(<LessonRow icon="play" title="x" meta="y" state="next" href="/x" badge={<span data-testid="b">Next</span>} />);
    expect(screen.getByTestId('b')).toBeInTheDocument();
  });
});
