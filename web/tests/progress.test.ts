import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTrackProgress, fetchConceptProgress } from '@/lib/progress';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTrackProgress', () => {
  it('returns TrackProgress on 200', async () => {
    const mock = {
      trackId: 't1',
      lessons: [
        { lessonId: 'l1', lessonVersion: 1, totalExercises: 3, passedExercises: 1,
          attemptedExercises: 2, state: 'in_progress', lastAttemptAt: '2026-04-20T10:00:00Z' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await fetchTrackProgress('t1');

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/tracks/t1'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await fetchTrackProgress('missing');
    expect(result).toBeNull();
  });

  it('throws on other non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchTrackProgress('t1')).rejects.toThrow('track progress 500');
  });
});

describe('fetchConceptProgress', () => {
  it('returns ConceptsProgress on 200', async () => {
    const mock = {
      concepts: [
        { concept: 'functions', totalExercises: 10, passedExercises: 8 },
        { concept: 'strings', totalExercises: 5, passedExercises: 5 },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await fetchConceptProgress();

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/progress/concepts'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchConceptProgress()).rejects.toThrow('concept progress 401');
  });
});
