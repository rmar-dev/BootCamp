import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaderboardPageHead } from '@/components/leaderboard/LeaderboardPageHead';

describe('LeaderboardPageHead', () => {
  it('shows cohort name in eyebrow when scope is cohort', () => {
    render(
      <LeaderboardPageHead period="weekly" onPeriodChange={() => {}} myLeague={null} scope="cohort" cohortName="Spring2026" />,
    );
    expect(screen.getByText(/Spring2026/i)).toBeInTheDocument();
  });

  it('shows "Showing all students" eyebrow when scope is global', () => {
    render(
      <LeaderboardPageHead period="weekly" onPeriodChange={() => {}} myLeague={null} scope="global" cohortName={null} />,
    );
    expect(screen.getByText(/Showing all students/i)).toBeInTheDocument();
  });

  it('marks the active period segment', () => {
    render(
      <LeaderboardPageHead period="monthly" onPeriodChange={() => {}} myLeague={null} scope="global" cohortName={null} />,
    );
    const monthlyBtn = screen.getByRole('button', { name: /Monthly/i });
    expect(monthlyBtn).toHaveClass('active');
  });

  it('calls onPeriodChange when a different period is clicked', async () => {
    const onChange = vi.fn();
    render(
      <LeaderboardPageHead period="weekly" onPeriodChange={onChange} myLeague={null} scope="global" cohortName={null} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /All-time/i }));
    expect(onChange).toHaveBeenCalledWith('all-time');
  });
});
