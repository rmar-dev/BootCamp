import { getApiBase } from './api-base';
// Help requests — the contextual "Need help?" surface anchored to a lesson,
// exercise, or attempt. Backed by /api/help-requests/* (student-facing) and
// /api/instructor/help-requests (instructor inbox).

const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type HelpAnchorKind = 'lesson' | 'exercise' | 'attempt';
export type HelpRequestStatus = 'open' | 'answered' | 'resolved';

export interface HelpRequest {
  id: string;
  studentId: string;
  instructorId: string;
  anchorKind: HelpAnchorKind;
  anchorId: string;
  title: string;
  status: HelpRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface HelpMessage {
  id: string;
  helpRequestId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface HelpRequestWithMessages extends HelpRequest {
  messages: HelpMessage[];
}

// ── Student-facing ─────────────────────────────────────────────────────────

export async function createHelpRequest(input: {
  anchorKind: HelpAnchorKind;
  anchorId: string;
  title: string;
  body: string;
}): Promise<HelpRequestWithMessages> {
  const res = await authFetch('/api/help-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`createHelpRequest failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as HelpRequestWithMessages;
}

export async function fetchHelpRequest(id: string): Promise<HelpRequestWithMessages | null> {
  const res = await authFetch(`/api/help-requests/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchHelpRequest failed: ${res.status}`);
  return (await res.json()) as HelpRequestWithMessages;
}

export async function appendHelpReply(id: string, body: string): Promise<HelpMessage> {
  const res = await authFetch(`/api/help-requests/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`appendHelpReply failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as HelpMessage;
}

export async function setHelpRequestStatus(
  id: string,
  status: HelpRequestStatus,
): Promise<HelpRequest> {
  const res = await authFetch(`/api/help-requests/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`setHelpRequestStatus failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as HelpRequest;
}

// ── Instructor inbox ───────────────────────────────────────────────────────

export async function fetchInstructorInbox(
  status?: HelpRequestStatus,
): Promise<HelpRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authFetch(`/api/instructor/help-requests${qs}`);
  if (!res.ok) throw new Error(`fetchInstructorInbox failed: ${res.status}`);
  return (await res.json()) as HelpRequest[];
}
