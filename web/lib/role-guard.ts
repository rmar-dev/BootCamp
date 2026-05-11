import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserResponse } from './auth';

// Dev port is 3002 (TileWebApp squats on 3000); prod sets NEXT_PUBLIC_API_BASE.
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

/**
 * Server-side gate for any /instructor/* route. Resolves the calling user via
 * the platform's /api/auth/me using forwarded cookies, then redirects:
 *   - unauthenticated → /login
 *   - student          → /dashboard
 * Returns the user when authorized so callers can branch on role/userId
 * without re-fetching.
 *
 * IMPORTANT: this runs in a server component, so it cannot itself refresh an
 * expired token — middleware.ts has already done that step before the page
 * renders. If the access token is genuinely missing/invalid, /api/auth/me
 * returns null and we treat the user as unauthenticated.
 */
export async function requireInstructor(): Promise<UserResponse> {
  const cookieHeader = cookies().toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/auth/me`, {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      // 2s ceiling: SSR is loopback in dev and intra-cluster in prod; if the
      // platform is hung past that the page would hang too. Fail closed below.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Platform unreachable / timed out. Fail closed — push back to login
    // rather than render an instructor page with a runtime error in a child
    // server component.
    redirect('/login');
  }
  if (!res.ok) redirect('/login');
  const json = await res.json().catch(() => null);
  const user: UserResponse | null = json?.user ?? null;
  if (!user) redirect('/login');
  if (user.role !== 'instructor' && user.role !== 'admin') {
    redirect('/dashboard');
  }
  return user;
}
