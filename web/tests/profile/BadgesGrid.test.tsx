import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgesGrid } from '@/components/profile/BadgesGrid';

describe('BadgesGrid', () => {
  it('shows "X / N earned" header', () => {
    const badges = [
      { id: 'a', name: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' },
      { id: 'b', name: 'B', description: 'b', icon: 'flame', earned: true, earnedAt: '2026-04-25' },
      { id: 'c', name: 'C', description: 'c', icon: 'star', earned: false, earnedAt: null },
    ];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText(/2 \/ 3 earned/i)).toBeInTheDocument();
  });

  it('renders each badge with title and description', () => {
    const badges = [{ id: 'a', name: 'First lesson', description: 'Did one lesson', icon: 'trophy', earned: true, earnedAt: '2026-04-19' }];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText('First lesson')).toBeInTheDocument();
    expect(screen.getByText('Did one lesson')).toBeInTheDocument();
  });

  it('shows "Earned <date>" for earned and "Locked" for unearned', () => {
    const badges = [
      { id: 'a', name: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' },
      { id: 'b', name: 'B', description: 'b', icon: 'star', earned: false, earnedAt: null },
    ];
    render(<BadgesGrid badges={badges} />);
    expect(screen.getByText(/Earned/i)).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
  });

  it('applies .locked class to unearned medals', () => {
    const badges = [{ id: 'a', name: 'A', description: 'a', icon: 'trophy', earned: false, earnedAt: null }];
    const { container } = render(<BadgesGrid badges={badges} />);
    expect(container.querySelector('.medal.locked')).toBeInTheDocument();
  });
});
