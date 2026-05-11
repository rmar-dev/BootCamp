import { describe, expect, it } from 'vitest';
import { cn } from '@/components/ui/cn';

describe('cn', () => {
  it('joins truthy parts with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });
  it('returns empty string when all parts falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
