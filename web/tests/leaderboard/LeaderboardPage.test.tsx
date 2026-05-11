import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';
import type { LeaderboardResponse } from '@/lib/gamification';

const replace = vi.fn();
const useSearchParams = vi.fn(() => new URLSearchParams(''));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock('@/lib/gamification', async () => {
  const actual = await vi.importActual<typeof import('@/lib/gamification')>('@/lib/gamification');
  return { ...actual, fetchLeaderboard: vi.fn(async (period: string) => ({ ...sampleData, period })) };
});
import { fetchLeaderboard } from '@/lib/gamification';

const sampleData: LeaderboardResponse = {
  period: 'weekly',
  entries: [
    { rank: 1, studentId: 's-1', name: 'A', initials: 'A', language: 'swift', totalPoints: 100, streak: 1, isMe: false },
    { rank: 2, studentId: 's-2', name: 'B', initials: 'B', language: 'kotlin', totalPoints: 80, streak: 1, isMe: true },
    { rank: 3, studentId: 's-3', name: 'C', initials: 'C', language: 'swift', totalPoints: 60, streak: 1, isMe: false },
    { rank: 4, studentId: 's-4', name: 'D', initials: 'D', language: 'swift', totalPoints: 40, streak: 1, isMe: false },
  ],
  myRank: 2,
  myLeague: { name: 'Bronze', xpToNext: 200, nextLeague: 'Silver' },
  scope: 'cohort',
  cohortName: 'Spring2026',
};

beforeEach(() => {
  replace.mockReset();
  useSearchParams.mockReturnValue(new URLSearchParams(''));
  vi.mocked(fetchLeaderboard).mockClear();
});

describe('LeaderboardPage', () => {
  it('renders podium for top 3 and list for the rest', () => {
    render(<LeaderboardPage initialData={sampleData} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(document.querySelectorAll('.lb-row')).toHaveLength(1);
  });

  it('reads period from ?period=', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('period=monthly'));
    const monthlyData: LeaderboardResponse = { ...sampleData, period: 'monthly' };
    render(<LeaderboardPage initialData={monthlyData} />);
    expect(screen.getByRole('button', { name: /Monthly/i })).toHaveClass('active');
  });

  it('routes to ?period= when a tab is clicked', async () => {
    render(<LeaderboardPage initialData={sampleData} />);
    await userEvent.click(screen.getByRole('button', { name: /All-time/i }));
    expect(replace).toHaveBeenCalledWith('?period=all-time', expect.objectContaining({ scroll: false }));
  });

  it('refetches when ?period= changes', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('period=monthly'));
    render(<LeaderboardPage initialData={sampleData} />);
    await waitFor(() => expect(fetchLeaderboard).toHaveBeenCalledWith('monthly'));
  });
});
