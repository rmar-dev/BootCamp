import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ActiveTrackPill } from '@/components/shell/ActiveTrackPill';
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

describe('ActiveTrackPill', () => {
  it('shows Swift badge when active track is swift (default)', async () => {
    vi.mocked(useAuth).mockReturnValue({ totalPoints: 1240 } as never);
    const { container } = wrap(<ActiveTrackPill />);
    await waitFor(() => expect(container.querySelector('.badge-iris')).not.toBeNull());
    expect(screen.getByText('Swift')).toBeTruthy();
    expect(screen.getByText(/Active track/i)).toHaveClass('eyebrow');
  });

  it('shows Kotlin badge when active track is kotlin', async () => {
    vi.mocked(useAuth).mockReturnValue({ totalPoints: 1240 } as never);
    localStorage.setItem('bootcamp.activeTrackId', 'kotlin-id');
    const { container } = wrap(<ActiveTrackPill />);
    await waitFor(() => expect(container.querySelector('.badge-amber')).not.toBeNull());
    expect(screen.getByText('Kotlin')).toBeTruthy();
  });

  it('renders the user totalPoints in the meta line', async () => {
    vi.mocked(useAuth).mockReturnValue({ totalPoints: 1240 } as never);
    wrap(<ActiveTrackPill />);
    await waitFor(() => expect(screen.getByText(/1,240 XP/)).toBeTruthy());
  });
});
