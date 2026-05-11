import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardPodium } from '@/components/leaderboard/LeaderboardPodium';
import type { LeaderboardEntry } from '@/lib/leaderboard.zod';

const e = (rank: number, name: string, xp: number, lang: 'swift' | 'kotlin' = 'swift'): LeaderboardEntry => ({
  rank, studentId: `s-${rank}`, name, initials: name[0],
  language: lang, totalPoints: xp, streak: 5, isMe: false,
});

describe('LeaderboardPodium', () => {
  it('renders top 3 with their names and XP', () => {
    const entries: LeaderboardEntry[] = [
      e(1, 'Maya Okafor', 4280),
      e(2, 'Tarun Patel', 3940, 'kotlin'),
      e(3, 'Saga Lindqvist', 3210),
    ];
    render(<LeaderboardPodium entries={entries} />);
    expect(screen.getByText('Maya Okafor')).toBeInTheDocument();
    expect(screen.getByText('Tarun Patel')).toBeInTheDocument();
    expect(screen.getByText('Saga Lindqvist')).toBeInTheDocument();
    expect(screen.getByText(/4,280 XP/i)).toBeInTheDocument();
  });

  it('handles a single-entry podium gracefully', () => {
    const entries: LeaderboardEntry[] = [e(1, 'Solo', 1000)];
    render(<LeaderboardPodium entries={entries} />);
    expect(screen.getByText('Solo')).toBeInTheDocument();
  });

  it('does not crash on empty input', () => {
    const { container } = render(<LeaderboardPodium entries={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
