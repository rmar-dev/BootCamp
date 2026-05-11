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
  opts?: { preview?: boolean },
): Promise<TrackDetail | null> {
  // preview=true bypasses cohort gating and per-cohort skill-tree overrides
  // on the platform side, returning the canonical track sequence. Used by
  // the instructor skill-tree composer so editing an existing override
  // doesn't silently re-seed from itself.
  const qs = opts?.preview ? '?mode=preview' : '';
  const res = await fetch(`${BASE}/api/tracks/${id}${qs}`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`track fetch failed: ${res.status}`);
  return res.json();
}
