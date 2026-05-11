import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardList } from '@/components/leaderboard/LeaderboardList';
import type { LeaderboardEntry } from '@/lib/leaderboard.zod';

const e = (rank: number, name: string, isMe = false): LeaderboardEntry => ({
  rank, studentId: `s-${rank}`, name, initials: name[0],
  language: 'swift', totalPoints: 1000 - rank * 10, streak: 5, isMe,
});

describe('LeaderboardList', () => {
  it('renders one .lb-row per entry with rank, name, XP', () => {
    const entries = [e(4, 'D'), e(5, 'E'), e(6, 'F')];
    const { container } = render(<LeaderboardList entries={entries} />);
    expect(container.querySelectorAll('.lb-row')).toHaveLength(3);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('applies .you class to the row matching isMe=true', () => {
    const entries = [e(4, 'D'), e(5, 'E', true), e(6, 'F')];
    const { container } = render(<LeaderboardList entries={entries} />);
    const youRow = container.querySelector('.lb-row.you');
    expect(youRow).toBeInTheDocument();
    expect(youRow?.textContent).toContain('E');
  });

  it('renders nothing for empty input', () => {
    const { container } = render(<LeaderboardList entries={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
