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

// Resolve the in-cluster platform URL for the SSR-side refresh call.
//
// Lessons learned the hard way:
//   1. NEXT_PUBLIC_API_BASE is baked as "" in production (same-origin via
//      Caddy on the client). On the server, "" is a relative URL — undici
//      rejects it. The ?? fallback doesn't fire because "" is not nullish.
//   2. INTERNAL_API_BASE is set at *runtime* by docker-compose, but in
//      Next.js 14 Edge Runtime middleware, runtime env reads can be
//      unreliable depending on how the build inlines process.env. If the
//      var wasn't present at build time, it can bake as undefined.
//   3. NODE_ENV is reliably inlined by Next.js itself.
//
// So: in production, default the BASE to the docker-compose service name
// ("platform" at :3002). The container env's INTERNAL_API_BASE still wins
// if it makes it through to runtime — this is just the floor so we never
// hand undici a relative URL or a port no one is listening on.
function resolveBase(): string {
  const internal = process.env.INTERNAL_API_BASE;
  if (internal && internal.length > 0) return internal;
  const pub = process.env.NEXT_PUBLIC_API_BASE;
  if (pub && /^https?:\/\//.test(pub)) return pub;
  if (process.env.NODE_ENV === 'production') return 'http://platform:3002';
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
    '/admin/:path*',
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
