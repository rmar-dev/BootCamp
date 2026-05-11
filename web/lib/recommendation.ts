import { getApiBase } from './api-base';
const BASE = getApiBase();

export type Recommendation = {
  kind: 'continue' | 'concept_gap' | 'first_timer';
  lesson: {
    id: string;
    version: number;
    title: string;
    trackId: string;
    trackTitle: string;
  } | null;
  reason: { message: string };
};

export async function fetchRecommendation(trackId: string): Promise<Recommendation> {
  const res = await fetch(
    `${BASE}/api/progress/recommendation?trackId=${encodeURIComponent(trackId)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`recommendation fetch failed: ${res.status}`);
  return res.json();
}
