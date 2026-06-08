import { getApiBase } from './api-base';
export type TrackSummary = {
  id: string;
  version: number;
  title: string;
  language: string;
  kind: string;
  description: string;
  lessonCount: number;
  starterRepoUrl: string | null;
};

export type LessonSummary = {
  id: string;
  version: number;
  title: string;
  level: string;
  summary: string;
  position: number;
};

export type TrackDetail = TrackSummary & { lessons: LessonSummary[] };

const BASE = getApiBase();

export async function fetchTracks(): Promise<TrackSummary[]> {
  const res = await fetch(`${BASE}/api/tracks`, { credentials: 'include' });
  if (!res.ok) throw new Error(`tracks fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTrack(
  id: string,
  opts?: { preview?: boolean; previewTreeId?: string },
): Promise<TrackDetail | null> {
  // preview=true bypasses cohort gating and per-cohort skill-tree overrides
  // on the platform side, returning the canonical track sequence. Used by
  // the instructor skill-tree composer so editing an existing override
  // doesn't silently re-seed from itself.
  //
  // previewTreeId (instructor/admin only) renders a specific skill tree's
  // lesson sequence — the "preview this tree as a student" path. It implies
  // preview mode.
  const params = new URLSearchParams();
  if (opts?.preview || opts?.previewTreeId) params.set('mode', 'preview');
  if (opts?.previewTreeId) params.set('previewTreeId', opts.previewTreeId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE}/api/tracks/${id}${qs}`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`track fetch failed: ${res.status}`);
  return res.json();
}
