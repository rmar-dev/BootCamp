const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

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
