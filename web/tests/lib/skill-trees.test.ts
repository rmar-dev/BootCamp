import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearAssignment,
  createTree,
  deleteTree,
  getAssignment,
  getTree,
  listAssignments,
  listCohorts,
  listTrees,
  setAssignment,
  updateTree,
} from '@/lib/skill-trees';

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

function textResponse(body: string, status = 400): Response {
  return new Response(body, { status });
}

describe('lib/skill-trees', () => {
  // ── trees ───────────────────────────────────────────────────────────────
  describe('listTrees', () => {
    it('passes trackId as a query param', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      await listTrees('track-1');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/trees?trackId=track-1');
    });

    it('throws on non-OK', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('boom', 500));
      await expect(listTrees('t')).rejects.toThrow(/listTrees failed: 500/);
    });
  });

  describe('getTree', () => {
    it('returns the tree on success', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id: 't1', name: 'A', lessonIds: ['l1'] }),
      );
      const r = await getTree('t1');
      expect(r?.name).toBe('A');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      expect(await getTree('t1')).toBeNull();
    });
  });

  describe('createTree', () => {
    it('POSTs the body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 't1', name: 'A' }));
      await createTree({
        trackId: 'tr1',
        name: 'A',
        visibility: 'private',
        lessonIds: ['l1', 'l2'],
      });
      const [, init] = fetchMock.mock.calls[0];
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        trackId: 'tr1',
        name: 'A',
        visibility: 'private',
        lessonIds: ['l1', 'l2'],
      });
    });

    it('surfaces server errors with the body text', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('name cannot be empty', 400));
      await expect(
        createTree({ trackId: 't', name: '', visibility: 'private', lessonIds: ['l'] }),
      ).rejects.toThrow(/createTree failed: 400 name cannot be empty/);
    });
  });

  describe('updateTree', () => {
    it('PUTs only the supplied patch fields', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 't1' }));
      await updateTree('t1', { lessonIds: ['l1', 'l2', 'l3'] });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/trees/t1');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({ lessonIds: ['l1', 'l2', 'l3'] });
    });
  });

  describe('deleteTree', () => {
    it('DELETEs the tree', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await deleteTree('t1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/trees/t1');
      expect(init?.method).toBe('DELETE');
    });

    it('is idempotent on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      await expect(deleteTree('t1')).resolves.toBeUndefined();
    });

    it('surfaces non-404 errors with the body text', async () => {
      fetchMock.mockResolvedValueOnce(
        textResponse('tree is currently assigned', 400),
      );
      await expect(deleteTree('t1')).rejects.toThrow(
        /deleteTree failed: 400 tree is currently assigned/,
      );
    });
  });

  // ── assignments ─────────────────────────────────────────────────────────
  describe('listAssignments', () => {
    it('GETs the index', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      await listAssignments();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/assignments');
    });
  });

  describe('getAssignment', () => {
    it('GETs the composite path and returns the row', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          cohortId: 'c1',
          trackId: 'tr1',
          skillTreeId: 'st1',
          skillTree: { id: 'st1', name: 'Plan A' },
        }),
      );
      const r = await getAssignment('c1', 'tr1');
      expect(r?.skillTree.name).toBe('Plan A');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      expect(await getAssignment('c1', 'tr1')).toBeNull();
    });

    it('returns null when server body is null (no row)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(null));
      expect(await getAssignment('c1', 'tr1')).toBeNull();
    });
  });

  describe('setAssignment', () => {
    it('PUTs the skillTreeId in the body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ cohortId: 'c1' }));
      await setAssignment('c1', 'tr1', 'st1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/assignments/c1/tr1');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({ skillTreeId: 'st1' });
    });
  });

  describe('clearAssignment', () => {
    it('DELETEs the assignment', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await clearAssignment('c1', 'tr1');
      const [, init] = fetchMock.mock.calls[0];
      expect(init?.method).toBe('DELETE');
    });

    it('is idempotent on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      await expect(clearAssignment('c1', 'tr1')).resolves.toBeUndefined();
    });
  });

  // ── cohorts ─────────────────────────────────────────────────────────────
  describe('listCohorts', () => {
    it('GETs the cohort listing endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      await listCohorts();
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/skill-tree/cohorts');
    });
  });
});
