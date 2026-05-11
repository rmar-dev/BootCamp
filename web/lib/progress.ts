import { getApiBase } from './api-base';
export type LessonProgressState = 'not_started' | 'in_progress' | 'complete';

export type LessonProgress = {
  lessonId: string;
  lessonVersion: number;
  totalExercises: number;
  passedExercises: number;
  attemptedExercises: number;
  state: LessonProgressState;
  lastAttemptAt: string | null;
};

export type TrackProgress = {
  trackId: string;
  lessons: LessonProgress[];
};

export type ConceptProgress = {
  concept: string;
  totalExercises: number;
  passedExercises: number;
};

export type ConceptsProgress = {
  concepts: ConceptProgress[];
};

const BASE = getApiBase();

export async function fetchTrackProgress(trackId: string): Promise<TrackProgress | null> {
  const res = await fetch(`${BASE}/api/progress/tracks/${trackId}`, { credentials: 'include' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`track progress ${res.status}`);
  return res.json();
}

export async function fetchConceptProgress(): Promise<ConceptsProgress> {
  const res = await fetch(`${BASE}/api/progress/concepts`, { credentials: 'include' });
  if (!res.ok) throw new Error(`concept progress ${res.status}`);
  return res.json();
}
