import { BASE } from './api';
import type { LessonResponse } from './api';

export class PoolCompleteError extends Error {
  constructor(public readonly code: string = 'pool_complete') {
    super(code);
    this.name = 'PoolCompleteError';
  }
}

async function requestJson(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return res;
}

export async function revisitLesson(lessonId: string): Promise<LessonResponse> {
  const res = await requestJson(`/api/lessons/${lessonId}/revisit`, { method: 'POST' });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    throw new PoolCompleteError(body?.error ?? 'pool_complete');
  }
  if (!res.ok) throw new Error(`revisit failed: ${res.status}`);
  return res.json();
}
