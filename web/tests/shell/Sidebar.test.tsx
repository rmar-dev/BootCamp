import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/shell/Sidebar';
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}));
import { usePathname } from 'next/navigation';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/components/shell/ReviewQueueBadge', () => ({
  ReviewQueueBadge: () => null,
}));
vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue([]);
});

const wrap = (node: React.ReactNode) => render(<TrackProvider>{node}</TrackProvider>);

describe('Sidebar', () => {
  it('renders main nav items', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    wrap(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Skill tree')).toBeTruthy();
    expect(screen.getByText('Continue lesson')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText(/design system/i)).toBeTruthy();
  });

  it('does NOT render Instructor for student role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    wrap(<Sidebar />);
    expect(screen.queryByText('Instructor')).toBeNull();
  });

  it('renders Instructor for instructor role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Mx', email: 'mx@x', role: 'instructor' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    wrap(<Sidebar />);
    expect(screen.getByText('Instructor')).toBeTruthy();
  });

  it('renders Instructor for admin role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Mx', email: 'mx@x', role: 'admin' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    wrap(<Sidebar />);
    expect(screen.getByText('Instructor')).toBeTruthy();
  });

  it('marks Dashboard active when pathname is /dashboard', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan', email: 'j@x', role: 'student' },
      streak: 0,
      totalPoints: 0,
    } as never);
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    const { container } = wrap(<Sidebar />);
    const dashLink = Array.from(container.querySelectorAll('a')).find((a) => a.textContent?.includes('Dashboard'));
    expect(dashLink).toHaveClass('active');
  });
});
