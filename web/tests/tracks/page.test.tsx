import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TracksPage from '@/app/(authed)/(shell)/tracks/page';
import { useActiveTrack } from '@/lib/track-context';
import { fetchTrack } from '@/lib/tracks';
import { fetchTrackProgress } from '@/lib/progress';

const { searchParamsMock } = vi.hoisted(() => ({
  searchParamsMock: { current: new URLSearchParams() },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParamsMock.current,
}));

vi.mock('@/lib/track-context', () => ({
  useActiveTrack: vi.fn(),
}));

vi.mock('@/lib/tracks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tracks')>('@/lib/tracks');
  return {
    ...actual,
    fetchTrack: vi.fn(),
  };
});

vi.mock('@/lib/progress', async () => {
  const actual = await vi.importActual<typeof import('@/lib/progress')>('@/lib/progress');
  return {
    ...actual,
    fetchTrackProgress: vi.fn(),
  };
});

beforeEach(() => {
  vi.mocked(useActiveTrack).mockReset();
  vi.mocked(fetchTrack).mockReset();
  vi.mocked(fetchTrackProgress).mockReset();
  searchParamsMock.current = new URLSearchParams();
});

const swiftTrack = {
  id: 'swift',
  title: 'Swift Foundations',
  description: 'Swift desc',
  language: 'swift',
  kind: 'foundation',
  version: 1,
  lessonCount: 6,
  starterRepoUrl: null,
  lessons: Array.from({ length: 6 }, (_, i) => ({
    id: `L${i + 1}`,
    version: 1,
    title: `Lesson ${i + 1}`,
    summary: '',
    position: i + 1,
    level: 'foundation',
  })),
};

describe('TracksPage', () => {
  it('renders TreeSkeleton while track context is loading', () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: true });
    render(<TracksPage />);
    expect(screen.getByTestId('tree-skeleton')).toBeInTheDocument();
  });

  it('renders empty-track state when no active trackId after loading', () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: false });
    render(<TracksPage />);
    expect(screen.getByText(/Pick a track from the topbar/i)).toBeInTheDocument();
  });

  it('renders inline error with retry when fetchTrack rejects', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    vi.mocked(fetchTrack).mockRejectedValueOnce(new Error('boom'));
    vi.mocked(fetchTrackProgress).mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders the tree with no progress when fetchTrackProgress fails', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    vi.mocked(fetchTrack).mockResolvedValueOnce(swiftTrack as any);
    vi.mocked(fetchTrackProgress).mockRejectedValueOnce(new Error('progress fail'));
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('Swift Foundations · Part 1')).toBeInTheDocument());
    const buttons = document.querySelectorAll('button.node');
    expect(buttons).toHaveLength(6);
  });

  it('renders empty-lessons state for a track with zero lessons', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'swift', tracks: [{ ...swiftTrack, lessons: [] } as any], setTrackId: vi.fn(), loading: false });
    vi.mocked(fetchTrack).mockResolvedValueOnce({ ...swiftTrack, lessons: [] } as any);
    vi.mocked(fetchTrackProgress).mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText(/No lessons in this track yet/i)).toBeInTheDocument());
  });

  it('renders the tree happy path: page-head + section + lesson nodes', async () => {
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'swift', tracks: [swiftTrack as any], setTrackId: vi.fn(), loading: false });
    vi.mocked(fetchTrack).mockResolvedValueOnce(swiftTrack as any);
    vi.mocked(fetchTrackProgress).mockResolvedValueOnce(null);
    render(<TracksPage />);
    await waitFor(() => expect(screen.getByText('Swift Foundations · Part 1')).toBeInTheDocument());
    expect(screen.getByText('Your path forward.')).toBeInTheDocument();
    expect(screen.getByText('0 of 6 lessons')).toBeInTheDocument();
  });

  it('preview mode (?previewTreeId): shows the preview banner and fetches that tree', async () => {
    searchParamsMock.current = new URLSearchParams('previewTreeId=tree-1&trackId=swift');
    // In preview the active-track context is irrelevant; the URL drives it.
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: [], setTrackId: vi.fn(), loading: false });
    vi.mocked(fetchTrack).mockResolvedValueOnce(swiftTrack as any);
    render(<TracksPage />);
    await waitFor(() =>
      expect(screen.getByText(/how this skill tree renders for a student/i)).toBeInTheDocument(),
    );
    expect(fetchTrack).toHaveBeenCalledWith('swift', { previewTreeId: 'tree-1' });
    // Progress is never fetched in preview mode.
    expect(fetchTrackProgress).not.toHaveBeenCalled();
  });
});
