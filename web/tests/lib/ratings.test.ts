import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deleteRating, fetchRatings, upsertRating } from '@/lib/ratings';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('lib/ratings', () => {
  it('fetchRatings GETs the public read endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchRatings('att1');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/attempts/att1/ratings');
  });

  it('upsertRating POSTs the body to the instructor write endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'r1' }));
    await upsertRating({ attemptId: 'att1', score: 4, comment: 'nice' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/instructor/ratings');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      attemptId: 'att1',
      score: 4,
      comment: 'nice',
    });
  });

  it('deleteRating DELETEs and is idempotent on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(deleteRating('r1')).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/instructor/ratings/r1');
    expect(init?.method).toBe('DELETE');
  });

  it('deleteRating throws on other non-OK statuses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(deleteRating('r1')).rejects.toThrow(/deleteRating failed: 500/);
  });
});
