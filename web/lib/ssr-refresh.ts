/**
 * Helpers for the middleware's SSR-side token refresh.
 * Pure, runtime-agnostic — no Next.js types so they can be unit tested
 * without faking out NextRequest/NextResponse.
 */

/** Refresh slightly before expiry to avoid racing the platform's exp check. */
export const REFRESH_SKEW_SECONDS = 60;

/**
 * True if the access token is missing/malformed/already-expired or expires
 * within `skewSeconds`. Treats anything we cannot parse as needing refresh
 * so callers fail closed (try the refresh, then the platform decides).
 */
export function needsRefresh(
  accessToken: string | undefined,
  nowMs: number = Date.now(),
  skewSeconds: number = REFRESH_SKEW_SECONDS,
): boolean {
  if (!accessToken) return true;
  const exp = readJwtExp(accessToken);
  if (exp === null) return true;
  const nowSec = Math.floor(nowMs / 1000);
  return exp <= nowSec + skewSeconds;
}

export function readJwtExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const b64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  // Edge runtime, browsers, and modern Node all expose atob globally.
  return atob(b64);
}

/**
 * Extract the value of the named cookie from an array of raw Set-Cookie
 * header strings. Returns the first match. Returns null if the cookie isn't
 * present in any of the strings.
 */
export function parseSetCookieValue(setCookies: string[], name: string): string | null {
  for (const sc of setCookies) {
    const first = sc.split(';', 1)[0];
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    if (first.slice(0, eq).trim() === name) {
      return first.slice(eq + 1).trim();
    }
  }
  return null;
}

/**
 * Pull all Set-Cookie headers from a fetch Response. The standard Headers API
 * folds repeated headers, but Set-Cookie is special-cased — Edge runtime
 * (and Node 18+) exposes `getSetCookie()`. Falls back to the single-header
 * case otherwise.
 */
export function collectSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}
