import { describe, it, expect } from 'vitest';
import { deriveInitials } from '@/lib/initials';

describe('deriveInitials', () => {
  it('returns first letters of first two name parts', () => {
    expect(deriveInitials('Jordan Kim')).toBe('JK');
    expect(deriveInitials('Maya Okafor Lee')).toBe('MO');
  });
  it('handles single-name input', () => {
    expect(deriveInitials('Madonna')).toBe('M');
  });
  it('uppercases', () => {
    expect(deriveInitials('jordan kim')).toBe('JK');
  });
  it('trims whitespace', () => {
    expect(deriveInitials('  Jordan  Kim  ')).toBe('JK');
  });
  it('returns ? for empty', () => {
    expect(deriveInitials('')).toBe('?');
    expect(deriveInitials('   ')).toBe('?');
  });
});
