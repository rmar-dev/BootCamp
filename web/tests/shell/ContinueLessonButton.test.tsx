import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ContinueLessonButton } from '@/components/shell/ContinueLessonButton';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/lib/track-context', () => ({
  useActiveTrack: vi.fn(),
}));
import { useActiveTrack } from '@/lib/track-context';

vi.mock('@/lib/recommendation', () => ({
  fetchRecommendation: vi.fn(),
}));
import { fetchRecommendation } from '@/lib/recommendation';

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ streak: 0 } as never);
  vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: false } as never);
  vi.mocked(fetchRecommendation).mockReset();
});

describe('ContinueLessonButton', () => {
  it('falls back to /tracks when no active track', () => {
    render(<ContinueLessonButton active={false} />);
    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute('href', '/tracks');
    expect(fetchRecommendation).not.toHaveBeenCalled();
  });

  it('points at /lesson/<id> and shows the lesson title after recommendation resolves', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'track-1', tracks: [], setTrackId: vi.fn(), loading: false } as never);
    vi.mocked(fetchRecommendation).mockResolvedValue({
      kind: 'first_timer',
      lesson: { id: 'lesson-A', version: 1, title: 'Intro & Toolchain', trackId: 'track-1', trackTitle: 'Swift' },
      reason: { message: 'Start here.' },
    });
    render(<ContinueLessonButton active={false} />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /intro & toolchain/i })).toHaveAttribute('href', '/lesson/lesson-A'),
    );
  });

  it('falls back to /tracks when recommendation has no lesson', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'track-1', tracks: [], setTrackId: vi.fn(), loading: false } as never);
    vi.mocked(fetchRecommendation).mockResolvedValue({
      kind: 'first_timer',
      lesson: null,
      reason: { message: 'No lessons yet.' },
    });
    render(<ContinueLessonButton active={false} />);
    await waitFor(() => expect(fetchRecommendation).toHaveBeenCalledWith('track-1'));
    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute('href', '/tracks');
  });

  it('falls back to /tracks when recommendation fetch errors', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'track-1', tracks: [], setTrackId: vi.fn(), loading: false } as never);
    vi.mocked(fetchRecommendation).mockRejectedValue(new Error('boom'));
    render(<ContinueLessonButton active={false} />);
    await waitFor(() => expect(fetchRecommendation).toHaveBeenCalledWith('track-1'));
    expect(screen.getByRole('link', { name: /continue lesson/i })).toHaveAttribute('href', '/tracks');
  });

  it('renders Day {streak} badge when streak > 0', () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 12 } as never);
    render(<ContinueLessonButton active={false} />);
    expect(screen.getByText('Day 12')).toBeTruthy();
  });

  it('renders no badge when streak is 0', () => {
    const { container } = render(<ContinueLessonButton active={false} />);
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('emits .side-link.active when active', () => {
    const { container } = render(<ContinueLessonButton active />);
    expect(container.firstChild).toHaveClass('side-link', 'active');
  });
});
