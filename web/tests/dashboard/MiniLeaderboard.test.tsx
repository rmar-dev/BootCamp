import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MiniLeaderboard } from '@/components/dashboard/MiniLeaderboard';
import type { LeaderboardEntry } from '@/lib/gamification';

const ENTRIES: LeaderboardEntry[] = [
  { rank: 1, studentId: 's1', name: 'M. Okafor',     totalPoints: 4280, streak: 14 },
  { rank: 2, studentId: 's2', name: 'T. Patel',      totalPoints: 3940, streak: 12 },
  { rank: 3, studentId: 's3', name: 'S. Lindqvist',  totalPoints: 3210, streak: 10 },
  { rank: 4, studentId: 's4', name: 'A. Karlsson',   totalPoints: 2900, streak: 9 },
  { rank: 7, studentId: 'me', name: 'Jordan Kim',    totalPoints: 1240, streak: 5 },
];

describe('MiniLeaderboard', () => {
  it('renders top-3 plus "you" when user is outside the top-3', () => {
    render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    expect(screen.getByText('M. Okafor')).toBeInTheDocument();
    expect(screen.getByText('T. Patel')).toBeInTheDocument();
    expect(screen.getByText('S. Lindqvist')).toBeInTheDocument();
    expect(screen.getByText(/Jordan Kim/)).toBeInTheDocument();
    expect(screen.queryByText('A. Karlsson')).not.toBeInTheDocument();
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it('does NOT duplicate the user row when user is in the top-3', () => {
    const e: LeaderboardEntry[] = ENTRIES.map((x, i) =>
      i === 0 ? { ...x, studentId: 'me' } : x,
    );
    render(<MiniLeaderboard entries={e} myStudentId="me" />);
    // Only one row with rank 1
    const rank1 = screen.getAllByText('1');
    expect(rank1).toHaveLength(1);
  });

  it('applies .lb-rank.top to rank 1', () => {
    const { container } = render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    const ranks = container.querySelectorAll('.lb-rank');
    expect(ranks[0].classList.contains('top')).toBe(true);
    expect(ranks[1].classList.contains('top')).toBe(false);
  });

  it('applies .lb-row.you to current user row', () => {
    const { container } = render(<MiniLeaderboard entries={ENTRIES} myStudentId="me" />);
    const youRow = container.querySelector('.lb-row.you');
    expect(youRow).toBeInTheDocument();
    expect(youRow?.textContent).toContain('Jordan Kim');
  });

  it('renders empty-state when no entries', () => {
    render(<MiniLeaderboard entries={[]} myStudentId="me" />);
    expect(screen.getByText(/No leaderboard entries/i)).toBeInTheDocument();
  });
});
