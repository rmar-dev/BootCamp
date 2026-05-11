import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfilePage } from '@/components/profile/ProfilePage';
import type { ProfileResponse } from '@/lib/profile';

const fixture: ProfileResponse = {
  account: { studentId: 's-1', name: 'Jordan Kim', email: 'j@x.com', createdAt: '2026-03-01T00:00:00Z', level: 3 },
  trackBadges: [{ language: 'swift', trackTitle: 'Swift Fundamentals' }],
  kpis: { totalPoints: 1240, currentStreak: 12, badgesEarned: 4, badgesTotal: 18 },
  heatStrip: Array.from({ length: 182 }, () => 0),
  skills: [{ trackId: 't-1', title: 'Swift Fundamentals', language: 'swift', progressPct: 80 }],
  badges: [{ id: 'a', name: 'A', description: 'a', icon: 'trophy', earned: true, earnedAt: '2026-04-19' }],
};

describe('ProfilePage', () => {
  it('renders all major sections', () => {
    render(<ProfilePage data={fixture} />);
    expect(screen.getByText('Jordan Kim')).toBeInTheDocument();
    expect(document.querySelector('.heat')).toBeInTheDocument();
    expect(screen.getByText('Swift Fundamentals')).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 1 earned/i)).toBeInTheDocument();
  });
});
