import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TreePageHead } from '@/components/tracks/TreePageHead';

describe('TreePageHead', () => {
  it('renders eyebrow with capitalized track name', () => {
    render(<TreePageHead language="swift" totalLessons={26} completedLessons={4} />);
    expect(screen.getByText('Skill tree · Swift track')).toBeInTheDocument();
  });

  it('renders eyebrow for Kotlin', () => {
    render(<TreePageHead language="kotlin" totalLessons={10} completedLessons={0} />);
    expect(screen.getByText('Skill tree · Kotlin track')).toBeInTheDocument();
  });

  it('renders the h-display headline', () => {
    render(<TreePageHead language="swift" totalLessons={1} completedLessons={0} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Your path forward.');
    expect(h1.classList.contains('h-display')).toBe(true);
  });

  it('renders the muted intro copy', () => {
    render(<TreePageHead language="swift" totalLessons={1} completedLessons={0} />);
    expect(screen.getByText(/Sections unlock as you master the previous one/)).toBeInTheDocument();
  });

  it('renders language badge with iris tint for Swift', () => {
    const { container } = render(<TreePageHead language="swift" totalLessons={1} completedLessons={0} />);
    expect(container.querySelector('.badge.badge-iris')).toBeInTheDocument();
  });

  it('renders language badge with amber tint for Kotlin', () => {
    const { container } = render(<TreePageHead language="kotlin" totalLessons={1} completedLessons={0} />);
    expect(container.querySelector('.badge.badge-amber')).toBeInTheDocument();
  });

  it('renders "X of Y lessons" badge', () => {
    render(<TreePageHead language="swift" totalLessons={26} completedLessons={4} />);
    expect(screen.getByText('4 of 26 lessons')).toBeInTheDocument();
  });

  it('falls back to a neutral badge for unknown languages', () => {
    const { container } = render(<TreePageHead language="rust" totalLessons={1} completedLessons={0} />);
    const langBadge = container.querySelectorAll('.badge')[0];
    expect(langBadge.classList.contains('badge-iris')).toBe(false);
    expect(langBadge.classList.contains('badge-amber')).toBe(false);
  });
});
