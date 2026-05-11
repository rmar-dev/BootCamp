import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assignStudent,
  fetchRoster,
  fetchStudentDetail,
  fetchUnassigned,
  removeExamOverride,
  setDifficulty,
  setExamOverride,
} from '@/lib/students';

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

describe('lib/students', () => {
  describe('fetchRoster', () => {
    it('GETs the roster endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      await fetchRoster();
      expect(fetchMock.mock.calls[0][0]).toContain('/api/instructor/students');
    });

    it('throws on non-OK', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('boom', 500));
      await expect(fetchRoster()).rejects.toThrow(/fetchRoster failed: 500/);
    });
  });

  describe('fetchUnassigned', () => {
    it('GETs the unassigned endpoint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      await fetchUnassigned();
      expect(fetchMock.mock.calls[0][0]).toContain('/api/instructor/students/unassigned');
    });
  });

  describe('fetchStudentDetail', () => {
    it('returns the body on success', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ student: { id: 's1' } }));
      const r = await fetchStudentDetail('s1');
      expect(r?.student.id).toBe('s1');
    });

    it('returns null on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      expect(await fetchStudentDetail('s1')).toBeNull();
    });
  });

  describe('assignStudent', () => {
    it('PUTs instructorUserId in the body', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 's1', instructorId: 'u1' }));
      await assignStudent('s1', 'u1');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/students/s1/assign');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({ instructorUserId: 'u1' });
    });

    it('passes null to release', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 's1' }));
      await assignStudent('s1', null);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ instructorUserId: null });
    });
  });

  describe('setDifficulty', () => {
    it('PUTs the baseline', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ baseline: 'easy' }));
      await setDifficulty('s1', 'easy');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/students/s1/difficulty');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual({ baseline: 'easy' });
    });
  });

  describe('setExamOverride', () => {
    it('PUTs the override fields', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'o1' }));
      await setExamOverride('s1', {
        exerciseId: 'ex1',
        exerciseVersion: 2,
        extendTimeMs: 60_000,
        optional: true,
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/students/s1/exam-override');
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toMatchObject({
        exerciseId: 'ex1',
        exerciseVersion: 2,
        extendTimeMs: 60_000,
        optional: true,
      });
    });
  });

  describe('removeExamOverride', () => {
    it('DELETEs by composite path and is idempotent on 404', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('not found', 404));
      await expect(removeExamOverride('s1', 'ex1')).resolves.toBeUndefined();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/instructor/students/s1/exam-override/ex1');
      expect(init?.method).toBe('DELETE');
    });
  });
});
