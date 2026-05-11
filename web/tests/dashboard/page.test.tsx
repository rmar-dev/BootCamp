import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import DashboardPage from '@/app/(authed)/(shell)/dashboard/page';
import { TrackProvider } from '@/lib/track-context';
import * as tracksLib from '@/lib/tracks';
import * as gamLib from '@/lib/gamification';
import * as progLib from '@/lib/progress';
import { dashboardContinueFixture } from '@/lib/__fixtures__/dashboard.fixture';

vi.mock('@/lib/tracks');
vi.mock('@/lib/gamification');
vi.mock('@/lib/progress');
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Jordan Kim' }, loading: false, streak: 12, totalPoints: 1240 }),
}));

const TRACKS = [
  { id: 'swift', version: 1, title: 'iOS Development with SwiftUI', language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Compose fundamentals',          language: 'kotlin', kind: 'language', description: '', lessonCount: 18, starterRepoUrl: null },
];

const TRACK_DETAIL = {
  ...TRACKS[0],
  lessons: [
    { id: 'lesson-state-bindings', version: 1, title: 'State', level: 'foundation', summary: '', position: 8 },
    { id: 'lesson-next', version: 1, title: 'Next', level: 'foundation', summary: '', position: 9 },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(tracksLib.fetchTracks).mockResolvedValue(TRACKS);
  vi.mocked(tracksLib.fetchTrack).mockResolvedValue(TRACK_DETAIL);
  vi.mocked(progLib.fetchTrackProgress).mockResolvedValue({ trackId: 'swift', lessons: [] });
  vi.mocked(gamLib.fetchDashboard).mockResolvedValue(dashboardContinueFixture);
  vi.mocked(gamLib.fetchMiniLeaderboard).mockResolvedValue({
    entries: [{ rank: 1, studentId: 's1', name: 'M. Okafor', totalPoints: 4280, streak: 14 }],
    myRank: null,
  });
});

describe('DashboardPage orchestrator', () => {
  it('renders the skeleton initially', () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('renders the dashboard after data loads', async () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => {
      expect(screen.getByText('State, Bindings, and the @State property wrapper')).toBeInTheDocument();
    });
    expect(screen.getAllByText('iOS Development with SwiftUI').length).toBeGreaterThan(0);
  });

  it('passes the active trackId to fetchDashboard', async () => {
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => expect(vi.mocked(gamLib.fetchDashboard)).toHaveBeenCalledWith('swift'));
  });

  it('renders DashboardError on fetch failure', async () => {
    vi.mocked(gamLib.fetchDashboard).mockRejectedValueOnce(new Error('boom'));
    render(<TrackProvider><DashboardPage /></TrackProvider>);
    await waitFor(() => expect(screen.getByText("Couldn't load dashboard")).toBeInTheDocument());
  });
});
