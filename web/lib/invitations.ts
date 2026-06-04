import { getApiBase } from './api-base';
const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type InvitationRole = 'student' | 'instructor' | 'admin';

export type Invitation = {
  id: string;
  email: string;
  userId: string;
  invitedById: string;
  role: InvitationRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type IssuedInvitation = {
  invitation: Invitation;
  token: string; // raw token, shown once
  acceptUrlPath: string; // e.g. /accept-invite?token=...
};

export async function createInvitation(
  email: string,
  name: string,
  role: InvitationRole,
): Promise<IssuedInvitation> {
  const res = await authFetch('/api/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, name, role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'invite_failed');
  return json;
}

export async function listInvitations(): Promise<Invitation[]> {
  const res = await authFetch('/api/invitations');
  if (!res.ok) throw new Error(`list invitations failed: ${res.status}`);
  return res.json();
}

export async function revokeInvitation(id: string): Promise<void> {
  const res = await authFetch(`/api/invitations/${id}/revoke`, { method: 'POST' });
  if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
}
