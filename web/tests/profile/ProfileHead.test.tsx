import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileHead } from '@/components/profile/ProfileHead';

describe('ProfileHead', () => {
  const account = { studentId: 's-1', name: 'Jordan Kim', email: 'j@x.com', createdAt: '2026-03-01T00:00:00Z', level: 3 };
  const trackBadges = [{ language: 'swift' as const, trackTitle: 'Swift Fundamentals' }];
  const kpis = { totalPoints: 1240, currentStreak: 12, badgesEarned: 4, badgesTotal: 18 };

  it('renders name + level + member-since eyebrow', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText('Jordan Kim')).toBeInTheDocument();
    expect(screen.getByText(/Member since/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 3/i)).toBeInTheDocument();
  });

  it('renders KPI strip with formatted points and streak', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText(/1,240/i)).toBeInTheDocument();
    expect(screen.getByText(/12 d/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 18/i)).toBeInTheDocument();
  });

  it('renders track badges with correct color class', () => {
    const { container } = render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(container.querySelector('.badge-iris')).toBeInTheDocument();
  });

  it('renders avatar with initials', () => {
    render(<ProfileHead account={account} trackBadges={trackBadges} kpis={kpis} />);
    expect(screen.getByText('JK')).toBeInTheDocument();
  });
});
