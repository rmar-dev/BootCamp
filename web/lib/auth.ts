import { getApiBase } from './api-base';
export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  status: 'invited' | 'active' | 'disabled';
  googleId: string | null;
  createdAt: string;
};

const BASE = getApiBase();

async function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export async function login(email: string, password: string): Promise<UserResponse> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'login_failed');
  return json.user;
}

export async function acceptInvite(token: string, password: string): Promise<UserResponse> {
  const res = await authFetch('/api/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'accept_failed');
  return json.user;
}

export async function fetchMe(): Promise<UserResponse | null> {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const json = await res.json();
    return json.user ?? null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' });
}
