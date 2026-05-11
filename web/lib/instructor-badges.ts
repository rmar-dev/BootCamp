import { getApiBase } from './api-base';
// Client for /api/instructor/badges — list/create/update/delete + manual award.
//
// All endpoints require role=instructor or role=admin (enforced by NestJS
// RolesGuard). The corresponding pages also sit under /instructor/*, which is
// gated by app/(authed)/(shell)/instructor/layout.tsx, so a student calling
// these helpers from the browser console is the only realistic abuse path —
// and it's blocked by the API itself.

// Dev port is 3002 (TileWebApp squats on 3000); prod sets NEXT_PUBLIC_API_BASE.
const BASE = getApiBase();

export type BadgeCriteriaKind =
  | 'system_first_submit'
  | 'system_first_pass'
  | 'system_streak_3'
  | 'system_streak_7'
  | 'system_all_types'
  | 'system_points_100'
  | 'system_points_500'
  | 'system_perfect_lesson'
  | 'manual_award'
  | 'points_threshold'
  | 'streak_threshold'
  | 'exercises_passed';

export type BadgeScopeKind = 'public' | 'cohort' | 'track' | 'private_to_student';

export type Badge = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  criteriaKind: BadgeCriteriaKind;
  thresholdValue: number | null;
  scopeKind: BadgeScopeKind;
  scopeId: string | null;
  authorUserId: string | null;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateBadgeInput = {
  name: string;
  description: string;
  icon: string;
  criteriaKind: 'manual_award' | 'points_threshold' | 'streak_threshold' | 'exercises_passed';
  thresholdValue?: number | null;
  scopeKind: BadgeScopeKind;
  scopeId?: string | null;
};

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export async function listInstructorBadges(): Promise<Badge[]> {
  const res = await authFetch('/api/instructor/badges');
  if (!res.ok) throw new Error(`listInstructorBadges failed: ${res.status}`);
  return res.json();
}

export async function createBadge(input: CreateBadgeInput): Promise<Badge> {
  const res = await authFetch('/api/instructor/badges', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createBadge failed: ${res.status} ${body}`);
  }
  return res.json();
}

export async function deleteBadge(badgeId: string): Promise<void> {
  const res = await authFetch(`/api/instructor/badges/${encodeURIComponent(badgeId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`deleteBadge failed: ${res.status}`);
  }
}

export async function awardBadge(badgeId: string, studentId: string): Promise<{ awarded: boolean }> {
  const res = await authFetch(`/api/instructor/badges/${encodeURIComponent(badgeId)}/award`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`awardBadge failed: ${res.status} ${body}`);
  }
  return res.json();
}
