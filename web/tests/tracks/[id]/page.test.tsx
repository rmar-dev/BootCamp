import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useParams, useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';
import TrackRedirectPage from '@/app/(authed)/(shell)/tracks/[id]/page';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/lib/track-context', () => ({
  useActiveTrack: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useParams).mockReset();
  vi.mocked(useRouter).mockReset();
  vi.mocked(useActiveTrack).mockReset();
});

const tracks = [
  { id: 'swift', title: 'Swift', description: '', language: 'swift', kind: 'foundation', version: 1, lessonCount: 6, starterRepoUrl: null },
  { id: 'kotlin', title: 'Kotlin', description: '', language: 'kotlin', kind: 'foundation', version: 1, lessonCount: 6, starterRepoUrl: null },
];

describe('TrackRedirectPage', () => {
  it('calls setTrackId and router.replace when ID exists in tracks', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'kotlin', tracks: tracks as any, setTrackId, loading: false });
    render(<TrackRedirectPage />);
    expect(setTrackId).toHaveBeenCalledWith('swift');
    expect(replace).toHaveBeenCalledWith('/tracks');
  });

  it('does NOT call setTrackId when ID is not in tracks but still redirects', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(useParams).mockReturnValue({ id: 'bogus' });
    vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: 'kotlin', tracks: tracks as any, setTrackId, loading: false });
    render(<TrackRedirectPage />);
    expect(setTrackId).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/tracks');
  });

  it('does nothing while track context is loading', () => {
    const setTrackId = vi.fn();
    const replace = vi.fn();
    vi.mocked(useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn() } as any);
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: [], setTrackId, loading: true });
    render(<TrackRedirectPage />);
    expect(setTrackId).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders null', () => {
    vi.mocked(useParams).mockReturnValue({ id: 'swift' });
    vi.mocked(useRouter).mockReturnValue({ replace: vi.fn(), push: vi.fn() } as any);
    vi.mocked(useActiveTrack).mockReturnValue({ trackId: null, tracks: tracks as any, setTrackId: vi.fn(), loading: false });
    const { container } = render(<TrackRedirectPage />);
    expect(container).toBeEmptyDOMElement();
  });
});
