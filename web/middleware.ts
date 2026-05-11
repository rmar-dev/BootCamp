import { NextResponse, type NextRequest } from 'next/server';
import { collectSetCookies, needsRefresh, parseSetCookieValue } from '@/lib/ssr-refresh';

/**
 * Transparent SSR refresh.
 *
 * The platform issues a 15-min `bc.access` JWT and a 7-day `bc.refresh` JWT
 * (scoped to /api/auth/refresh). Server components forward incoming cookies
 * to the platform via `cookies()` — they cannot themselves perform a refresh
 * round-trip and spill Set-Cookie back to the browser. Middleware can, so we
 * do it here once per request before the page renders.
 *
 * Invariant: this middleware NEVER blocks the request. On any failure path it
 * passes through and lets the downstream page handle the 401 the way it would
 * have anyway.
 */

// Same resolution order as lib/api-base.ts getApiBase() server branch:
// INTERNAL_API_BASE (in-cluster docker DNS) wins, then NEXT_PUBLIC_API_BASE
// if it's an absolute URL, else dev default. In production NEXT_PUBLIC_API_BASE
// is baked as "" for same-origin client use, so this MUST fall through to
// INTERNAL_API_BASE — otherwise fetch("/api/auth/refresh") is relative and
// undici rejects it, the refresh silently fails, and /dashboard 401s.
function resolveBase(): string {
  const internal = process.env.INTERNAL_API_BASE;
  if (internal && internal.length > 0) return internal;
  const pub = process.env.NEXT_PUBLIC_API_BASE;
  if (pub && /^https?:\/\//.test(pub)) return pub;
  return 'http://localhost:3002';
}
const BASE = resolveBase();

export async function middleware(req: NextRequest) {
  const refresh = req.cookies.get('bc.refresh')?.value;
  if (!refresh) return NextResponse.next();

  const access = req.cookies.get('bc.access')?.value;
  if (!needsRefresh(access)) return NextResponse.next();

  const refreshed = await tryRefresh(req);
  if (!refreshed) return NextResponse.next();

  // Mutate the in-flight request's cookies so the downstream server component's
  // `cookies()` reads the fresh token on this same render.
  req.cookies.set('bc.access', refreshed.accessToken);

  // Build the response from the (now-mutated) request and re-emit the platform's
  // Set-Cookie verbatim so the browser persists the refreshed cookie with all
  // its original attributes (HttpOnly, SameSite, Path, Max-Age).
  const response = NextResponse.next({ request: { headers: req.headers } });
  for (const setCookie of refreshed.setCookies) {
    response.headers.append('set-cookie', setCookie);
  }
  return response;
}

export const config = {
  matcher: [
    '/lesson/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/leaderboard/:path*',
    '/tracks/:path*',
    '/badges/:path*',
    '/instructor/:path*',
    '/review/:path*',
  ],
};

type RefreshOk = { accessToken: string; setCookies: string[] };

async function tryRefresh(req: NextRequest): Promise<RefreshOk | null> {
  const incomingCookie = req.headers.get('cookie');
  if (!incomingCookie) return null;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: incomingCookie },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const setCookies = collectSetCookies(res);
  const newAccess = parseSetCookieValue(setCookies, 'bc.access');
  if (!newAccess) return null;

  return { accessToken: newAccess, setCookies };
}
