// Multi-rater public project ratings. Backed by:
//   POST /api/instructor/ratings              (instructor-only write/upsert)
//   DELETE /api/instructor/ratings/:id        (rater or admin)
//   GET /api/attempts/:attemptId/ratings      (any authed user — public read)

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export interface ProjectRating {
  id: string;
  attemptId: string;
  raterUserId: string;
  score: number; // 1..5
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRatings(attemptId: string): Promise<ProjectRating[]> {
  const res = await authFetch(`/api/attempts/${encodeURIComponent(attemptId)}/ratings`);
  if (!res.ok) throw new Error(`fetchRatings failed: ${res.status}`);
  return (await res.json()) as ProjectRating[];
}

export async function upsertRating(input: {
  attemptId: string;
  score: number;
  comment: string;
}): Promise<ProjectRating> {
  const res = await authFetch('/api/instructor/ratings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`upsertRating failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as ProjectRating;
}

export async function deleteRating(id: string): Promise<void> {
  const res = await authFetch(`/api/instructor/ratings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteRating failed: ${res.status}`);
  }
}
