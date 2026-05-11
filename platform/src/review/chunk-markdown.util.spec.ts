// src/review/chunk-markdown.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import { chunkMarkdown } from './chunk-markdown.util';

describe('chunkMarkdown', () => {
  it('returns empty array for empty input', () => {
    expect(chunkMarkdown('', 40)).toEqual([]);
  });

  it('returns single chunk when input fits', () => {
    expect(chunkMarkdown('hi', 40)).toEqual(['hi']);
  });

  it('splits on chunk size boundary', () => {
    expect(chunkMarkdown('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('joining all chunks yields original input', () => {
    const md = '# Heading\n\nSome **bold** text and a `code` span.\n\nA second paragraph.';
    expect(chunkMarkdown(md, 12).join('')).toBe(md);
  });

  it('throws when size is < 1', () => {
    expect(() => chunkMarkdown('hi', 0)).toThrow();
  });
});
