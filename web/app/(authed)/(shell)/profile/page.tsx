import { cookies } from 'next/headers';
import { fetchProfile } from '@/lib/profile';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { InstructorProfilePage } from '@/components/profile/InstructorProfilePage';
import type { UserResponse } from '@/lib/auth';
import type { Badge } from '@/lib/instructor-badges';
import type { RosterEntry } from '@/lib/students';

export const dynamic = 'force-dynamic';

// Dev port is 3002 (TileWebApp squats on 3000); prod sets NEXT_PUBLIC_API_BASE.
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

// 2s ceiling on every SSR call. The profile is a leaf page; if the platform
// is unreachable, render with empty state rather than hang the whole request.
const SSR_TIMEOUT_MS = 2000;

async function fetchMeServer(cookieHeader: string): Promise<UserResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user ?? null;
  } catch {
    return null;
  }
}

async function fetchAuthored(cookieHeader: string): Promise<Badge[]> {
  try {
    const res = await fetch(`${BASE}/api/instructor/badges`, {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchRosterServer(cookieHeader: string): Promise<RosterEntry[]> {
  try {
    const res = await fetch(`${BASE}/api/instructor/students`, {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(SSR_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Page() {
  const cookieHeader = cookies().toString();
  const me = await fetchMeServer(cookieHeader);
  // Instructors and admins get a tailored surface — student page assumes a
  // Student row exists and would 500 for a pure-instructor user.
  if (me && (me.role === 'instructor' || me.role === 'admin')) {
    const [badges, roster] = await Promise.all([
      fetchAuthored(cookieHeader),
      fetchRosterServer(cookieHeader),
    ]);
    return <InstructorProfilePage user={me} badges={badges} roster={roster} />;
  }
  const data = await fetchProfile(cookieHeader);
  return <ProfilePage data={data} />;
}
