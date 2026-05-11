import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchReviewQueue, submitReview } from '@/lib/review';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchReviewQueue', () => {
  it('returns the queue payload on 200', async () => {
    const mock = {
      due: [
        { cardId: 'c1', exerciseId: 'e1', step: 2, dueAt: '2026-04-20T10:00:00Z',
          exercise: { id: 'e1', version: 1, type: 'multiple_choice',
            promptMarkdown: '?', payload: { type: 'multiple_choice' }, pointsMax: 10 } },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await fetchReviewQueue();

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review/queue'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchReviewQueue()).rejects.toThrow('review queue 500');
  });
});

describe('submitReview', () => {
  it('posts the payload and returns the result', async () => {
    const mock = {
      passed: true,
      card: { step: 3, nextDueAt: '2026-05-01T00:00:00Z', retiredAt: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mock }));

    const result = await submitReview('card-1', { selectedOptionIds: ['a'] });

    expect(result).toEqual(mock);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/review/card-1/submit'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ selectedOptionIds: ['a'] }),
      }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(submitReview('card-1', {})).rejects.toThrow('review submit 404');
  });
});
