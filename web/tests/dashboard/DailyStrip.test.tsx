import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DailyStrip } from '@/components/dashboard/DailyStrip';
import { dashboardContinueFixture, dashboardExhaustedFixture } from '@/lib/__fixtures__/dashboard.fixture';

describe('DailyStrip', () => {
  it('renders todayPlan title, badges, and KPIs', () => {
    render(<DailyStrip dash={dashboardContinueFixture} />);
    expect(screen.getByText('State, Bindings, and the @State property wrapper')).toBeInTheDocument();
    expect(screen.getByText('L8')).toBeInTheDocument();
    expect(screen.getByText('Concept + quiz')).toBeInTheDocument();
    expect(screen.getByText('6 min')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();              // streak value
    expect(screen.getByText('18 / 20')).toBeInTheDocument();          // daily xp
    expect(screen.getByText('L4')).toBeInTheDocument();               // mastery level
    expect(screen.getByText('360 XP to L5')).toBeInTheDocument();
  });

  it('shows "+1 today" delta when streakIncrementedToday is true', () => {
    render(<DailyStrip dash={dashboardContinueFixture} />);
    expect(screen.getByText('+1 today')).toBeInTheDocument();
  });

  it('shows "Keep going" delta when streakIncrementedToday is false', () => {
    const dash = { ...dashboardContinueFixture, streakIncrementedToday: false };
    render(<DailyStrip dash={dash} />);
    expect(screen.queryByText('+1 today')).not.toBeInTheDocument();
    expect(screen.getByText('Keep going')).toBeInTheDocument();
  });

  it('renders empty-state copy when todayPlan is null', () => {
    render(<DailyStrip dash={dashboardExhaustedFixture} />);
    expect(screen.getByText(/All caught up/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review queue/i })).toHaveAttribute('href', '/review');
    expect(screen.getByText('12')).toBeInTheDocument();               // KPIs still render
  });
});
