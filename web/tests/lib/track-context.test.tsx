import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { TrackProvider, useActiveTrack } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';

vi.mock('@/lib/tracks', () => ({ fetchTracks: vi.fn() }));

const TRACKS = [
  { id: 'swift', version: 1, title: 'Swift', language: 'swift', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Kotlin', language: 'kotlin', kind: 'language', description: '', lessonCount: 10, starterRepoUrl: null },
];

function Probe() {
  const { trackId, setTrackId, tracks, loading } = useActiveTrack();
  return (
    <>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="trackId">{trackId ?? 'null'}</span>
      <span data-testid="tracks">{tracks.map((t) => t.id).join(',')}</span>
      <button onClick={() => setTrackId('kotlin')}>switch</button>
    </>
  );
}

describe('TrackProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
  });

  it('renders with trackId=null while loading', async () => {
    let resolveTracks: (v: typeof TRACKS) => void = () => {};
    vi.mocked(tracksLib.fetchTracks).mockReturnValue(new Promise((r) => { resolveTracks = r; }));
    render(<TrackProvider><Probe /></TrackProvider>);
    expect(screen.getByTestId('trackId').textContent).toBe('null');
    expect(screen.getByTestId('loading').textContent).toBe('true');
    act(() => resolveTracks(TRACKS));
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  });

  it('defaults to first track when localStorage is empty', async () => {
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
    expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('swift');
  });

  it('hydrates from localStorage when present and valid', async () => {
    localStorage.setItem('bootcamp.activeTrackId', 'kotlin');
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('kotlin'));
  });

  it('falls back to first track when stored value is stale', async () => {
    localStorage.setItem('bootcamp.activeTrackId', 'rust');
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
  });

  it('persists setTrackId changes', async () => {
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('trackId').textContent).toBe('swift'));
    await userEvent.click(screen.getByText('switch'));
    expect(screen.getByTestId('trackId').textContent).toBe('kotlin');
    expect(localStorage.getItem('bootcamp.activeTrackId')).toBe('kotlin');
  });

  it('handles empty tracks array', async () => {
    vi.mocked(tracksLib.fetchTracks).mockResolvedValueOnce([]);
    render(<TrackProvider><Probe /></TrackProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('trackId').textContent).toBe('null');
  });

  it('throws when useActiveTrack is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <TrackProvider>/);
    spy.mockRestore();
  });
});
