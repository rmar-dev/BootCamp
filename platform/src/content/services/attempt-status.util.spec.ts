// src/content/services/attempt-status.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { computeStatus } from './attempt-status.util';

describe('computeStatus', () => {
  it('returns unattempted for empty input', () => {
    expect(computeStatus([])).toBe('unattempted');
  });

  it('returns first_try when earliest attempt passed', () => {
    expect(computeStatus([{ passed: true }])).toBe('first_try');
    expect(computeStatus([{ passed: true }, { passed: false }])).toBe('first_try');
    expect(computeStatus([{ passed: true }, { passed: true }])).toBe('first_try');
  });

  it('returns eventual when earliest attempt failed but a later one passed', () => {
    expect(computeStatus([{ passed: false }, { passed: true }])).toBe('eventual');
    expect(computeStatus([{ passed: false }, { passed: false }, { passed: true }])).toBe('eventual');
    // No-downgrade invariant: a later failure cannot revoke an earned eventual.
    expect(computeStatus([{ passed: false }, { passed: true }, { passed: false }])).toBe('eventual');
  });

  it('returns unattempted when all attempts failed (treated as not-yet-passed)', () => {
    expect(computeStatus([{ passed: false }])).toBe('unattempted');
    expect(computeStatus([{ passed: false }, { passed: false }])).toBe('unattempted');
  });
});
