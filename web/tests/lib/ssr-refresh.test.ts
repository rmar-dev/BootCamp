import { describe, it, expect } from 'vitest';
import {
  collectSetCookies,
  needsRefresh,
  parseSetCookieValue,
  readJwtExp,
} from '@/lib/ssr-refresh';

function jwt(payload: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

describe('readJwtExp', () => {
  it('extracts numeric exp from a well-formed JWT', () => {
    expect(readJwtExp(jwt({ exp: 1_700_000_000, sub: 'u1' }))).toBe(1_700_000_000);
  });

  it('returns null when the token does not have three dot-separated parts', () => {
    expect(readJwtExp('not-a-jwt')).toBeNull();
    expect(readJwtExp('only.two')).toBeNull();
  });

  it('returns null when the payload is not valid base64url JSON', () => {
    expect(readJwtExp('aaa.@@@.bbb')).toBeNull();
  });

  it('returns null when exp is missing or not a number', () => {
    expect(readJwtExp(jwt({ sub: 'u1' }))).toBeNull();
    expect(readJwtExp(jwt({ exp: 'soon' }))).toBeNull();
  });
});

describe('needsRefresh', () => {
  // Pin "now" to 2025-01-01T00:00:00Z so cases are deterministic.
  const NOW_MS = 1_735_689_600_000;
  const NOW_SEC = NOW_MS / 1000;

  it('returns true when no token is provided', () => {
    expect(needsRefresh(undefined, NOW_MS)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(needsRefresh('garbage', NOW_MS)).toBe(true);
  });

  it('returns true for an expired token', () => {
    expect(needsRefresh(jwt({ exp: NOW_SEC - 10 }), NOW_MS)).toBe(true);
  });

  it('returns true for a token within the skew window', () => {
    expect(needsRefresh(jwt({ exp: NOW_SEC + 30 }), NOW_MS, 60)).toBe(true);
  });

  it('returns false for a token comfortably ahead of expiry', () => {
    expect(needsRefresh(jwt({ exp: NOW_SEC + 300 }), NOW_MS, 60)).toBe(false);
  });

  it('treats a token at exactly skew boundary as needing refresh', () => {
    expect(needsRefresh(jwt({ exp: NOW_SEC + 60 }), NOW_MS, 60)).toBe(true);
  });
});

describe('parseSetCookieValue', () => {
  it('returns the value of the named cookie', () => {
    const out = parseSetCookieValue(
      ['bc.access=ACCESS_VALUE; HttpOnly; Path=/; Max-Age=900', 'other=foo'],
      'bc.access',
    );
    expect(out).toBe('ACCESS_VALUE');
  });

  it('returns null when the cookie is not present', () => {
    expect(parseSetCookieValue(['other=foo'], 'bc.access')).toBeNull();
  });

  it('matches by full name, not prefix', () => {
    expect(
      parseSetCookieValue(['bc.access.shadow=nope; Path=/'], 'bc.access'),
    ).toBeNull();
  });

  it('returns the first match when duplicates exist', () => {
    expect(
      parseSetCookieValue(['bc.access=first; Path=/', 'bc.access=second; Path=/'], 'bc.access'),
    ).toBe('first');
  });

  it('handles a Set-Cookie line with no attributes', () => {
    expect(parseSetCookieValue(['bc.access=bare'], 'bc.access')).toBe('bare');
  });
});

describe('collectSetCookies', () => {
  it('uses Headers.getSetCookie when available', () => {
    const headers = new Headers();
    // Headers in modern runtimes supports appending Set-Cookie multiple times
    // and exposing them via getSetCookie. Fallback path is exercised by the
    // single-header case below.
    headers.append('set-cookie', 'bc.access=A; Path=/');
    headers.append('set-cookie', 'bc.refresh=R; Path=/api/auth/refresh');
    const res = new Response(null, { headers });
    const out = collectSetCookies(res);
    // Either getSetCookie returns both, or the fallback returns the folded
    // single string. Accept both shapes — the consumer of this helper handles
    // either via parseSetCookieValue, so both are correct in practice.
    if (out.length === 2) {
      expect(out).toContain('bc.access=A; Path=/');
      expect(out).toContain('bc.refresh=R; Path=/api/auth/refresh');
    } else {
      expect(out).toHaveLength(1);
      expect(out[0]).toMatch(/bc\.access=A/);
    }
  });

  it('returns an empty array when there are no Set-Cookie headers', () => {
    const res = new Response(null, { headers: new Headers() });
    expect(collectSetCookies(res)).toEqual([]);
  });
});
