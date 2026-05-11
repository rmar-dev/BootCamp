export const INTERVALS_DAYS = [3, 7, 21, 60] as const;
export const MAX_STEP = INTERVALS_DAYS.length;

export function intervalDaysFor(step: number): number {
  // Steps are 1..MAX_STEP. INTERVALS_DAYS is 0-indexed.
  const clamped = Math.max(1, Math.min(MAX_STEP, step));
  return INTERVALS_DAYS[clamped - 1];
}

export function addDays(from: Date, days: number): Date {
  const out = new Date(from);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
