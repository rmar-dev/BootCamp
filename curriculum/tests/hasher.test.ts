import { describe, it, expect } from 'vitest';
import { stableId, contentHash } from '../src/hasher';

describe('stableId', () => {
  it('produces a valid UUID v5', () => {
    const id = stableId('track:swift-fundamentals');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    const a = stableId('exercise:swift-fundamentals/01-intro/0');
    const b = stableId('exercise:swift-fundamentals/01-intro/0');
    expect(a).toBe(b);
  });

  it('produces different IDs for different paths', () => {
    const a = stableId('exercise:swift-fundamentals/01-intro/0');
    const b = stableId('exercise:swift-fundamentals/01-intro/1');
    expect(a).not.toBe(b);
  });
});

describe('contentHash', () => {
  it('returns a hex string', () => {
    const hash = contentHash({ foo: 'bar' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const a = contentHash({ x: 1, y: 2 });
    const b = contentHash({ x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = contentHash({ x: 1 });
    const b = contentHash({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('is order-independent for object keys', () => {
    const a = contentHash({ x: 1, y: 2 });
    const b = contentHash({ y: 2, x: 1 });
    expect(a).toBe(b);
  });
});
