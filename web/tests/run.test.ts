import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runExercise } from '@/lib/run';

describe('runExercise', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as any).fetch = vi.fn();
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('posts to /api/run and returns the response', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        outcome: 'passed', passed: true, stdout: 'ok', stderr: '',
        durationMs: 123, timedOut: false,
      }),
    });
    const res = await runExercise('ex-1', 1, 'print("x")');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/run'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ exerciseId: 'ex-1', exerciseVersion: 1, code: 'print("x")' }),
      }),
    );
    expect(res.outcome).toBe('passed');
    expect(res.passed).toBe(true);
  });

  it('returns internal_error on network failure', async () => {
    (global.fetch as any).mockRejectedValue(new TypeError('fetch failed'));
    const res = await runExercise('ex-1', 1, 'x');
    expect(res.outcome).toBe('internal_error');
    expect(res.passed).toBe(false);
    expect(res.stderr).toContain('could not reach');
  });

  it('returns internal_error when response is not ok', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: 'boom' }),
    });
    const res = await runExercise('ex-1', 1, 'x');
    expect(res.outcome).toBe('internal_error');
  });
});
