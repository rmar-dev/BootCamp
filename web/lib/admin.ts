import { getApiBase } from './api-base';
const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type AdminUserRole = 'student' | 'instructor' | 'admin';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminUserRole;
  status: 'invited' | 'active' | 'disabled';
  createdAt: string;
};

export async function listUsers(): Promise<AdminUser[]> {
  const res = await authFetch('/api/admin/users');
  if (!res.ok) throw new Error(`list users failed: ${res.status}`);
  return res.json();
}

export async function changeUserRole(id: string, role: AdminUserRole): Promise<AdminUser> {
  const res = await authFetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'change_role_failed');
  return json;
}
