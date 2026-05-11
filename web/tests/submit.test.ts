import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitExercise } from '@/lib/submit';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('submitExercise', () => {
  it('returns SubmitResponse on success', async () => {
    const mockResponse = {
      passed: true,
      pointsAwarded: 50,
      totalPointsExercise: 100,
      totalPoints: 150,
      outcome: 'passed',
      stdout: 'Test output',
      stderr: '',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const result = await submitExercise('ex1', 1, { answer: 'Swift' });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/submit'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ exerciseId: 'ex1', exerciseVersion: 1, answer: 'Swift' }),
      }),
    );
  });

  it('returns synthetic error response on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    const result = await submitExercise('ex1', 1, { code: 'func foo() {}' });

    expect(result.passed).toBe(false);
    expect(result.pointsAwarded).toBe(0);
    expect(result.totalPointsExercise).toBe(0);
    expect(result.totalPoints).toBe(0);
    expect(result.outcome).toBe('internal_error');
    expect(result.stderr).toContain('could not reach submission service');
    expect(result.stderr).toContain('Network down');
  });
});
