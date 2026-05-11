import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Pin a stable "now" so JWT exp comparisons are deterministic.
const NOW_MS = 1_735_689_600_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

function jwt(payload: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeRequest(opts: { path?: string; cookies?: Record<string, string> } = {}): NextRequest {
  const path = opts.path ?? '/lesson/abc';
  const url = `http://localhost:3001${path}`;
  const cookieHeader = opts.cookies
    ? Object.entries(opts.cookies).map(([k, v]) => `${k}=${v}`).join('; ')
    : undefined;
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  fetchMock = vi.fn();
  originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.resetModules();
});

describe('middleware (SSR refresh)', () => {
  it('passes through when no refresh cookie is present', async () => {
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: {} }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
  });

  it('passes through when the access cookie is fresh', async () => {
    const fresh = jwt({ exp: NOW_SEC + 600 });
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.access': fresh, 'bc.refresh': 'r' } }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
  });

  it('refreshes when the access token is missing', async () => {
    const newAccess = jwt({ exp: NOW_SEC + 900 });
    const setCookie = `bc.access=${newAccess}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1' } }), {
        status: 200,
        headers: { 'set-cookie': setCookie },
      }),
    );
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.refresh': 'r' } }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toMatch(/\/api\/auth\/refresh$/);
    expect((calledInit as RequestInit).method).toBe('POST');
    expect((calledInit as RequestInit).headers).toMatchObject({ Cookie: 'bc.refresh=r' });

    const out = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')!].filter(Boolean);
    expect(out.some((s) => s.includes(`bc.access=${newAccess}`))).toBe(true);
  });

  it('refreshes when the access token is expired', async () => {
    const expired = jwt({ exp: NOW_SEC - 30 });
    const newAccess = jwt({ exp: NOW_SEC + 900 });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: 'u1' } }), {
        status: 200,
        headers: { 'set-cookie': `bc.access=${newAccess}; Path=/` },
      }),
    );
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.access': expired, 'bc.refresh': 'r' } }));
    expect(fetchMock).toHaveBeenCalledOnce();
    const out = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')!].filter(Boolean);
    expect(out.some((s) => s.includes(`bc.access=${newAccess}`))).toBe(true);
  });

  it('passes through silently when the platform refresh fails', async () => {
    const expired = jwt({ exp: NOW_SEC - 30 });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.access': expired, 'bc.refresh': 'r' } }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
  });

  it('passes through silently when the refresh fetch throws', async () => {
    const expired = jwt({ exp: NOW_SEC - 30 });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.access': expired, 'bc.refresh': 'r' } }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
  });

  it('passes through when refresh succeeds but no bc.access cookie comes back', async () => {
    const expired = jwt({ exp: NOW_SEC - 30 });
    fetchMock.mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'set-cookie': 'unrelated=value; Path=/' },
      }),
    );
    const { middleware } = await import('@/middleware');
    const res = await middleware(makeRequest({ cookies: { 'bc.access': expired, 'bc.refresh': 'r' } }));
    const out = res.headers.getSetCookie?.() ?? [];
    expect(out.some((s) => s.includes('bc.access='))).toBe(false);
  });
});
