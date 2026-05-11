import { getApiBase } from './api-base';
// Instructor-facing student roster + assignment + difficulty controls.
// Backed by /api/instructor/students/* endpoints.

const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type Language = 'swift' | 'kotlin';

export interface Student {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  cohortId: string | null;
  instructorId: string | null;
  language: Language | null;
  createdAt: string;
}

export interface RosterEntry extends Student {
  openHelpRequestCount: number;
}

export type DifficultyBaseline = 'easy' | 'standard' | 'challenging';

export interface ExamOverride {
  id: string;
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  extendTimeMs: number | null;
  optional: boolean;
  swapToExerciseId: string | null;
  swapToExerciseVersion: number | null;
  updatedAt: string;
  updatedBy: string;
}

export interface StudentTrackContext {
  trackId: string;
  trackVersion: number;
  trackTitle: string;
  language: string;
  // null when the student's cohort has no custom skill-tree assignment for
  // this track (students fall back to the canonical Track.lessonIds).
  activeSkillTree: { id: string; name: string } | null;
  availableTrees: Array<{
    id: string;
    name: string;
    visibility: 'private' | 'public';
    authorUserId: string;
  }>;
}

export interface StudentDetail {
  student: Student;
  cohortId: string | null;
  difficultyBaseline: DifficultyBaseline;
  examOverrides: ExamOverride[];
  openHelpRequestCount: number;
  tracks: StudentTrackContext[];
}

// ── Roster ─────────────────────────────────────────────────────────────────

export async function fetchRoster(): Promise<RosterEntry[]> {
  const res = await authFetch('/api/instructor/students');
  if (!res.ok) throw new Error(`fetchRoster failed: ${res.status}`);
  return (await res.json()) as RosterEntry[];
}

export async function fetchUnassigned(): Promise<Student[]> {
  const res = await authFetch('/api/instructor/students/unassigned');
  if (!res.ok) throw new Error(`fetchUnassigned failed: ${res.status}`);
  return (await res.json()) as Student[];
}

export async function fetchStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const res = await authFetch(`/api/instructor/students/${encodeURIComponent(studentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchStudentDetail failed: ${res.status}`);
  return (await res.json()) as StudentDetail;
}

export async function setStudentLanguage(
  studentId: string,
  language: Language | null,
): Promise<Student> {
  const res = await authFetch(
    `/api/instructor/students/${encodeURIComponent(studentId)}/language`,
    {
      method: 'PUT',
      body: JSON.stringify({ language }),
    },
  );
  if (!res.ok) throw new Error(`setStudentLanguage failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Student;
}

export async function assignStudent(
  studentId: string,
  instructorUserId: string | null,
): Promise<Student> {
  const res = await authFetch(
    `/api/instructor/students/${encodeURIComponent(studentId)}/assign`,
    {
      method: 'PUT',
      body: JSON.stringify({ instructorUserId }),
    },
  );
  if (!res.ok) throw new Error(`assignStudent failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Student;
}

// ── Difficulty ────────────────────────────────────────────────────────────

export async function setDifficulty(
  studentId: string,
  baseline: DifficultyBaseline,
): Promise<{ studentId: string; baseline: DifficultyBaseline; updatedAt: string }> {
  const res = await authFetch(
    `/api/instructor/students/${encodeURIComponent(studentId)}/difficulty`,
    {
      method: 'PUT',
      body: JSON.stringify({ baseline }),
    },
  );
  if (!res.ok) throw new Error(`setDifficulty failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function setExamOverride(
  studentId: string,
  input: {
    exerciseId: string;
    exerciseVersion: number;
    extendTimeMs?: number | null;
    optional?: boolean;
    swapToExerciseId?: string | null;
    swapToExerciseVersion?: number | null;
  },
): Promise<ExamOverride> {
  const res = await authFetch(
    `/api/instructor/students/${encodeURIComponent(studentId)}/exam-override`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`setExamOverride failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as ExamOverride;
}

export async function removeExamOverride(studentId: string, exerciseId: string): Promise<void> {
  const res = await authFetch(
    `/api/instructor/students/${encodeURIComponent(studentId)}/exam-override/${encodeURIComponent(exerciseId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`removeExamOverride failed: ${res.status}`);
  }
}
