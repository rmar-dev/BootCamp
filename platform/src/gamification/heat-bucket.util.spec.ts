// src/gamification/heat-bucket.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { toBucket } from './heat-bucket.util';

describe('toBucket', () => {
  it('returns 0 for zero activity', () => {
    expect(toBucket(0)).toBe(0);
  });

  it('returns 1 for exactly 1 activity', () => {
    expect(toBucket(1)).toBe(1);
  });

  it('returns 2 for 2-3 activities', () => {
    expect(toBucket(2)).toBe(2);
    expect(toBucket(3)).toBe(2);
  });

  it('returns 3 for 4-6 activities', () => {
    expect(toBucket(4)).toBe(3);
    expect(toBucket(6)).toBe(3);
  });

  it('returns 4 for 7+ activities', () => {
    expect(toBucket(7)).toBe(4);
    expect(toBucket(50)).toBe(4);
  });

  it('treats negative input defensively as 0', () => {
    expect(toBucket(-1)).toBe(0);
  });
});
