import { getApiBase } from './api-base';
const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: string;
  reviewedAt: string | null;
  queueType?: 'code_review' | 'capstone_approval';
};

export type AttemptDetail = {
  attemptId: string;
  code: string;
  exercisePrompt: string;
  language: string;
  passed: boolean;
  aiReviewMarkdown: string | null;
  submissionPayload?: Record<string, unknown>;
  approvedByInstructorId?: string | null;
};

export type InstructorReviewResponse = {
  id: string;
  attemptId: string;
  instructorId: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
  }>;
};

export async function fetchQueue(): Promise<QueueItem[]> {
  const res = await authFetch('/api/instructor/queue');
  if (!res.ok) throw new Error(`queue fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchReviewedQueue(): Promise<QueueItem[]> {
  const res = await authFetch('/api/instructor/queue/reviewed');
  if (!res.ok) throw new Error(`reviewed queue fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetail> {
  const res = await authFetch(`/api/instructor/attempt/${attemptId}`);
  if (!res.ok) throw new Error(`attempt detail fetch failed: ${res.status}`);
  return res.json();
}

export async function createInstructorReview(
  attemptId: string,
  markdown: string,
): Promise<InstructorReviewResponse> {
  const res = await authFetch('/api/instructor/review', {
    method: 'POST',
    body: JSON.stringify({ attemptId, markdown }),
  });
  if (!res.ok) throw new Error(`create review failed: ${res.status}`);
  return res.json();
}

export async function updateInstructorReview(
  id: string,
  markdown: string,
): Promise<InstructorReviewResponse> {
  const res = await authFetch(`/api/instructor/review/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ markdown }),
  });
  if (!res.ok) throw new Error(`update review failed: ${res.status}`);
  return res.json();
}

export async function fetchInstructorReview(
  attemptId: string,
): Promise<InstructorReviewResponse | null> {
  const res = await authFetch(`/api/instructor/review/${attemptId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetch review failed: ${res.status}`);
  return res.json();
}

export async function postReviewMessage(
  reviewId: string,
  body: string,
): Promise<{ id: string; authorId: string; body: string; createdAt: string }> {
  const res = await authFetch(`/api/instructor/review/${reviewId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`post message failed: ${res.status}`);
  return res.json();
}

export async function approveCapstone(
  attemptId: string,
): Promise<{ attempt: Record<string, unknown>; exerciseResult: Record<string, unknown> }> {
  const res = await authFetch(`/api/instructor/approve/${attemptId}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}
