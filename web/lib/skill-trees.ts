import { getApiBase } from './api-base';
// Authored skill trees + per-(cohort, track) assignments. Backed by the
// platform's SkillTree + CohortTrackAssignment tables via the
// /api/instructor/skill-tree/* endpoints.
//
// Authoring is independent from activation: an instructor creates / edits
// SkillTrees, then separately assigns one to a (cohort, track) pair so
// that cohort's students see it on their Your Path. Public trees are
// visible (and assignable) to every instructor; private trees only to
// their author.

const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type SkillTreeVisibility = 'private' | 'public';

export interface SkillTree {
  id: string;
  trackId: string;
  name: string;
  description: string | null;
  authorUserId: string;
  visibility: SkillTreeVisibility;
  lessonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CohortTrackAssignment {
  cohortId: string;
  trackId: string;
  skillTreeId: string;
  assignedAt: string;
  assignedBy: string;
}

export interface AssignmentWithTree extends CohortTrackAssignment {
  skillTree: SkillTree;
}

export interface CohortSummary {
  id: string;
  name: string;
  startDate: string;
  cohortLength: 'four_week' | 'twelve_week';
}

// ── Trees ───────────────────────────────────────────────────────────────────

export async function listTrees(trackId: string): Promise<SkillTree[]> {
  const res = await authFetch(
    `/api/instructor/skill-tree/trees?trackId=${encodeURIComponent(trackId)}`,
  );
  if (!res.ok) throw new Error(`listTrees failed: ${res.status}`);
  return (await res.json()) as SkillTree[];
}

export async function getTree(id: string): Promise<SkillTree | null> {
  const res = await authFetch(`/api/instructor/skill-tree/trees/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getTree failed: ${res.status}`);
  return (await res.json()) as SkillTree;
}

export async function createTree(input: {
  trackId: string;
  name: string;
  description?: string | null;
  visibility: SkillTreeVisibility;
  lessonIds: string[];
}): Promise<SkillTree> {
  const res = await authFetch('/api/instructor/skill-tree/trees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`createTree failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as SkillTree;
}

export async function updateTree(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    visibility: SkillTreeVisibility;
    lessonIds: string[];
  }>,
): Promise<SkillTree> {
  const res = await authFetch(`/api/instructor/skill-tree/trees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateTree failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as SkillTree;
}

export async function deleteTree(id: string): Promise<void> {
  const res = await authFetch(`/api/instructor/skill-tree/trees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteTree failed: ${res.status} ${await res.text()}`);
  }
}

// ── Assignments ─────────────────────────────────────────────────────────────

export async function listAssignments(): Promise<CohortTrackAssignment[]> {
  const res = await authFetch('/api/instructor/skill-tree/assignments');
  if (!res.ok) throw new Error(`listAssignments failed: ${res.status}`);
  return (await res.json()) as CohortTrackAssignment[];
}

export async function getAssignment(
  cohortId: string,
  trackId: string,
): Promise<AssignmentWithTree | null> {
  const res = await authFetch(
    `/api/instructor/skill-tree/assignments/${encodeURIComponent(cohortId)}/${encodeURIComponent(trackId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getAssignment failed: ${res.status}`);
  const body = await res.json();
  return body == null ? null : (body as AssignmentWithTree);
}

export async function setAssignment(
  cohortId: string,
  trackId: string,
  skillTreeId: string,
): Promise<CohortTrackAssignment> {
  const res = await authFetch(
    `/api/instructor/skill-tree/assignments/${encodeURIComponent(cohortId)}/${encodeURIComponent(trackId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ skillTreeId }),
    },
  );
  if (!res.ok) throw new Error(`setAssignment failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CohortTrackAssignment;
}

export async function clearAssignment(cohortId: string, trackId: string): Promise<void> {
  const res = await authFetch(
    `/api/instructor/skill-tree/assignments/${encodeURIComponent(cohortId)}/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`clearAssignment failed: ${res.status}`);
  }
}

// ── Cohort picker ───────────────────────────────────────────────────────────

export async function listCohorts(): Promise<CohortSummary[]> {
  const res = await authFetch('/api/instructor/skill-tree/cohorts');
  if (!res.ok) throw new Error(`listCohorts failed: ${res.status}`);
  return (await res.json()) as CohortSummary[];
}
