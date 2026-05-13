import { getApiBase } from './api-base';

// Student feedback. Two flavours via the same endpoint:
//   - per-lesson feedback (lessonId set, rating 1–5 required)
//   - general platform feedback (lessonId null, comment only)

const BASE = getApiBase();

export type FeedbackStatus = 'new' | 'seen' | 'resolved';

export interface Feedback {
  id: string;
  studentId: string;
  lessonId: string | null;
  rating: number | null;
  comment: string;
  status: FeedbackStatus;
  createdAt: string;
  seenAt: string | null;
  instructorReply: string | null;
  instructorReplyAt: string | null;
  instructorReplyBy: string | null;
}

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

// ── Student ────────────────────────────────────────────────────────────────

export async function submitFeedback(input: {
  lessonId?: string | null;
  rating?: number | null;
  comment: string;
}): Promise<Feedback> {
  const res = await authFetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      lessonId: input.lessonId ?? null,
      rating: input.rating ?? null,
      comment: input.comment,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`submitFeedback failed: ${res.status} ${text}`);
  }
  return (await res.json()) as Feedback;
}

export async function fetchMyFeedback(): Promise<Feedback[]> {
  const res = await authFetch('/api/feedback/mine');
  if (!res.ok) throw new Error(`fetchMyFeedback failed: ${res.status}`);
  return (await res.json()) as Feedback[];
}

// ── Instructor ─────────────────────────────────────────────────────────────

export async function fetchFeedbackInbox(): Promise<Feedback[]> {
  const res = await authFetch('/api/instructor/feedback');
  if (!res.ok) throw new Error(`fetchFeedbackInbox failed: ${res.status}`);
  return (await res.json()) as Feedback[];
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  instructorReply?: string,
): Promise<Feedback> {
  const res = await authFetch(
    `/api/instructor/feedback/${encodeURIComponent(id)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({ status, instructorReply }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`setFeedbackStatus failed: ${res.status} ${text}`);
  }
  return (await res.json()) as Feedback;
}
