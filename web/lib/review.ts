import { getApiBase } from './api-base';
export type ReviewQueueItem = {
  cardId: string;
  exerciseId: string;
  step: number;
  dueAt: string;
  exercise: {
    id: string;
    version: number;
    type: 'fill_blank' | 'predict_output' | 'multiple_choice';
    promptMarkdown: string;
    payload: unknown;
    pointsMax: number;
  };
};

export type ReviewQueueResponse = {
  due: ReviewQueueItem[];
};

export type ReviewSubmitResult = {
  passed: boolean;
  card: {
    step: number;
    nextDueAt: string | null;
    retiredAt: string | null;
  };
};

const BASE = getApiBase();

export async function fetchReviewQueue(): Promise<ReviewQueueResponse> {
  const res = await fetch(`${BASE}/api/review/queue`, { credentials: 'include' });
  if (!res.ok) throw new Error(`review queue ${res.status}`);
  return res.json();
}

export async function submitReview(
  cardId: string,
  payload: unknown,
): Promise<ReviewSubmitResult> {
  const res = await fetch(`${BASE}/api/review/${cardId}/submit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`review submit ${res.status}`);
  return res.json();
}
