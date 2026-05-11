import { describe, it, expect } from 'vitest';
import {
  detectFileMime,
  parseLoomId,
  parseVimeoId,
  parseYouTubeId,
  resolveVideoSource,
} from '@/lib/video-source';

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['http://youtube.com/watch?v=abc123_-X', 'abc123_-X'],
    ['https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts the id from %s', (url, expected) => {
    expect(parseYouTubeId(url)).toBe(expected);
  });

  it('returns null for non-YouTube URLs', () => {
    expect(parseYouTubeId('https://vimeo.com/76979871')).toBeNull();
    expect(parseYouTubeId('not a url')).toBeNull();
  });

  it('does not match watch URLs without a v= parameter', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?list=abc')).toBeNull();
  });
});

describe('parseVimeoId', () => {
  it.each([
    ['https://vimeo.com/76979871', '76979871'],
    ['https://www.vimeo.com/76979871', '76979871'],
    ['https://player.vimeo.com/video/76979871', '76979871'],
    ['https://vimeo.com/76979871?h=abc&autoplay=1', '76979871'],
  ])('extracts the id from %s', (url, expected) => {
    expect(parseVimeoId(url)).toBe(expected);
  });

  it('returns null when no numeric id is present', () => {
    expect(parseVimeoId('https://vimeo.com/user1234/profile')).toBeNull();
  });
});

describe('parseLoomId', () => {
  it('extracts the id from a share URL', () => {
    expect(parseLoomId('https://www.loom.com/share/abc123def456')).toBe('abc123def456');
  });

  it('extracts the id from an embed URL', () => {
    expect(parseLoomId('https://loom.com/embed/abc-123_def')).toBe('abc-123_def');
  });

  it('returns null when not a Loom URL', () => {
    expect(parseLoomId('https://example.com/share/abc')).toBeNull();
  });
});

describe('detectFileMime', () => {
  it.each([
    ['https://cdn.example.com/clip.mp4', 'video/mp4'],
    ['https://cdn.example.com/clip.m4v', 'video/mp4'],
    ['https://cdn.example.com/clip.webm', 'video/webm'],
    ['https://cdn.example.com/clip.ogg', 'video/ogg'],
    ['https://cdn.example.com/clip.mov', 'video/quicktime'],
  ])('detects %s', (url, mime) => {
    expect(detectFileMime(url)).toBe(mime);
  });

  it('strips query / hash before reading the extension', () => {
    expect(detectFileMime('https://cdn.example.com/clip.mp4?token=abc')).toBe('video/mp4');
    expect(detectFileMime('https://cdn.example.com/clip.mp4#t=10')).toBe('video/mp4');
  });

  it('returns null for unknown extensions and pathless URLs', () => {
    expect(detectFileMime('https://cdn.example.com/clip.xyz')).toBeNull();
    expect(detectFileMime('https://example.com/')).toBeNull();
  });
});

describe('resolveVideoSource', () => {
  it('routes YouTube URLs to the youtube embed', () => {
    const out = resolveVideoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(out).toEqual({
      kind: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    });
  });

  it('routes Vimeo URLs to the vimeo player embed', () => {
    const out = resolveVideoSource('https://vimeo.com/76979871');
    expect(out).toEqual({
      kind: 'vimeo',
      videoId: '76979871',
      embedUrl: 'https://player.vimeo.com/video/76979871',
    });
  });

  it('routes Loom URLs to the loom embed', () => {
    const out = resolveVideoSource('https://loom.com/share/abc123');
    expect(out).toEqual({
      kind: 'loom',
      videoId: 'abc123',
      embedUrl: 'https://www.loom.com/embed/abc123',
    });
  });

  it('routes direct file URLs to the native player with a MIME type', () => {
    const out = resolveVideoSource('https://cdn.example.com/clip.mp4');
    expect(out).toEqual({
      kind: 'file',
      url: 'https://cdn.example.com/clip.mp4',
      mimeType: 'video/mp4',
    });
  });

  it('falls back to a generic iframe for any other http(s) URL', () => {
    const out = resolveVideoSource('https://wistia.com/medias/abc');
    expect(out).toEqual({ kind: 'iframe', url: 'https://wistia.com/medias/abc' });
  });

  it('returns null for an empty or invalid URL', () => {
    expect(resolveVideoSource('')).toBeNull();
    expect(resolveVideoSource('   ')).toBeNull();
    expect(resolveVideoSource('not a url')).toBeNull();
  });

  it('YouTube wins over the generic iframe fallback', () => {
    // youtube.com URLs without a recognized id pattern would otherwise fall
    // through to the iframe branch — but a watch URL with a v= param must
    // route to the youtube embed, not an iframe of the watch page.
    const out = resolveVideoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(out?.kind).toBe('youtube');
  });
});
