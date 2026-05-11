import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Topbar } from '@/components/shell/Topbar';
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));
import { useAuth } from '@/components/layout/AuthProvider';

const TRACKS = [
  { id: 'swift-id', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
  { id: 'kotlin-id', version: 1, title: 'Kotlin', language: 'kotlin', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
];

beforeEach(() => {
  localStorage.clear();
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
});

const wrap = (node: React.ReactNode) => render(<TrackProvider>{node}</TrackProvider>);

describe('Topbar', () => {
  it('renders streak and totalPoints from useAuth', async () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 12, totalPoints: 1240 } as never);
    wrap(<Topbar />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1,240')).toBeTruthy();
  });

  it('renders a disabled search input', async () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    wrap(<Topbar />);
    const input = screen.getByPlaceholderText(/search lessons coming soon/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('renders both Swift and Kotlin segmented options after tracks load', async () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    wrap(<Topbar />);
    await waitFor(() => expect(screen.getByText('Swift')).toBeTruthy());
    expect(screen.getByText('Kotlin')).toBeTruthy();
  });

  it('clicking a segment calls setTrackId via the context', async () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    wrap(<Topbar />);
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeTruthy());
    await userEvent.click(screen.getByText('Kotlin'));
    expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('kotlin-id');
  });

  it('hides the SegmentedControl when no swift/kotlin tracks are available', async () => {
    vi.mocked(useAuth).mockReturnValue({ streak: 0, totalPoints: 0 } as never);
    vi.mocked(tracksLib.fetchTracks).mockResolvedValueOnce([]);
    wrap(<Topbar />);
    await waitFor(() => expect(screen.queryByText('Swift')).toBeNull());
    expect(screen.queryByText('Kotlin')).toBeNull();
  });
});
