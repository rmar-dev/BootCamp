// src/gamification/leaderboard-period.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { parsePeriod, computeWindowStart } from './leaderboard-period.util';

describe('parsePeriod', () => {
  it('returns the input when valid', () => {
    expect(parsePeriod('weekly')).toBe('weekly');
    expect(parsePeriod('monthly')).toBe('monthly');
    expect(parsePeriod('all-time')).toBe('all-time');
  });

  it('defaults to weekly for invalid or undefined', () => {
    expect(parsePeriod(undefined)).toBe('weekly');
    expect(parsePeriod('')).toBe('weekly');
    expect(parsePeriod('lifetime')).toBe('weekly');
  });
});

describe('computeWindowStart', () => {
  // Wednesday 2026-05-06 at 14:30 UTC
  const wed = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));

  it('returns most recent Monday 00:00 UTC for weekly', () => {
    const start = computeWindowStart('weekly', wed);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });

  it('returns 1st of current month 00:00 UTC for monthly', () => {
    const start = computeWindowStart('monthly', wed);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 1, 0, 0, 0)));
  });

  it('returns null for all-time', () => {
    expect(computeWindowStart('all-time', wed)).toBeNull();
  });

  it('handles Monday correctly (returns the same Monday at 00:00 UTC)', () => {
    const mon = new Date(Date.UTC(2026, 4, 4, 14, 30, 0));
    const start = computeWindowStart('weekly', mon);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });

  it('handles Sunday correctly (returns previous Monday)', () => {
    const sun = new Date(Date.UTC(2026, 4, 10, 23, 59, 0));
    const start = computeWindowStart('weekly', sun);
    expect(start).toEqual(new Date(Date.UTC(2026, 4, 4, 0, 0, 0)));
  });
});
