import { profileSchema, type ProfileResponse } from './profile.zod';
import { BASE } from './api';

export type { ProfileResponse };

export async function fetchProfile(cookieHeader?: string): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/api/profile/me`, {
    cache: 'no-store',
    credentials: 'include',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  if (!res.ok) throw new Error(`fetchProfile: ${res.status}`);
  const json = await res.json();
  return profileSchema.parse(json);
}
