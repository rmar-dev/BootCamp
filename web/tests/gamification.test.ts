import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDashboard, fetchMiniLeaderboard } from '@/lib/gamification';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchDashboard', () => {
  it('returns DashboardData on success', async () => {
    const mockData = {
      streak: 3,
      badges: [{ id: 'b1', name: 'First Submit', description: 'Made first submit', icon: '🚀', earned: true, earnedAt: '2026-04-01' }],
      rank: 2,
      totalPoints: 350,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const result = await fetchDashboard();

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/dashboard/me'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(fetchDashboard()).rejects.toThrow('dashboard 401');
  });
});

describe('fetchMiniLeaderboard', () => {
  it('returns LeaderboardData on success', async () => {
    const mockData = {
      entries: [
        { rank: 1, studentId: 'u1', name: 'Alice', totalPoints: 500, streak: 5 },
        { rank: 2, studentId: 'u2', name: 'Bob', totalPoints: 350, streak: 3 },
      ],
      myRank: 2,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const result = await fetchMiniLeaderboard();

    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/leaderboard'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('appends cohortId query param when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [], myRank: null }),
    }));

    await fetchMiniLeaderboard('cohort-abc');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cohortId=cohort-abc'),
      expect.anything(),
    );
  });
});
