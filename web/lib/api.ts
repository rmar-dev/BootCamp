import type { LessonBlock } from './exercise-payloads';

export const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export type LessonAssignmentState =
  | { status: 'active'; id: string; selectedExerciseIds: string[] }
  | { status: 'pool_complete'; allExerciseIds: string[] };

export type LessonResponse = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: LessonBlock[];
  assignment: LessonAssignmentState | null;
};

export type FetchLessonOptions = {
  cookieHeader?: string;
  /** Pass 'preview' to load the latest version without a per-student
   * assignment (for instructor preview / builder fork). Defaults to the
   * student-facing student-assignment-aware path. */
  mode?: 'preview';
};

export async function fetchLesson(
  id: string,
  optsOrCookie?: FetchLessonOptions | string,
): Promise<LessonResponse | null> {
  // Backwards-compatible: callers used to pass cookieHeader as a positional
  // string. Accept either shape.
  const opts: FetchLessonOptions =
    typeof optsOrCookie === 'string' ? { cookieHeader: optsOrCookie } : (optsOrCookie ?? {});
  const url = opts.mode === 'preview'
    ? `${BASE}/api/lessons/${id}?mode=preview`
    : `${BASE}/api/lessons/${id}`;
  const res = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    // In a Next.js server component the runtime fetch does not auto-forward
    // the incoming request's cookies — `credentials: 'include'` is a browser
    // semantic. The page.tsx caller passes cookieHeader (read via next/headers)
    // so the platform's JwtAuthGuard sees the JWT and authenticates the call.
    headers: opts.cookieHeader ? { Cookie: opts.cookieHeader } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchLesson ${id}: ${res.status}`);
  return (await res.json()) as LessonResponse;
}
