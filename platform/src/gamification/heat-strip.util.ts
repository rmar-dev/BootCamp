// src/gamification/heat-strip.util.ts
import { toBucket } from './heat-bucket.util';

export const HEAT_STRIP_DAYS = 26 * 7; // 182

export function startOfHeatStrip(now: Date = new Date()): Date {
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
    ),
  );
  start.setUTCDate(start.getUTCDate() - (HEAT_STRIP_DAYS - 1));
  return start;
}

export type HeatStripEvent = { submittedAt: Date };

export function buildHeatStrip(
  events: ReadonlyArray<HeatStripEvent>,
  start: Date,
): number[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const startMs = start.getTime();
  const counts = new Array<number>(HEAT_STRIP_DAYS).fill(0);
  for (const e of events) {
    const idx = Math.floor((e.submittedAt.getTime() - startMs) / dayMs);
    if (idx < 0 || idx >= HEAT_STRIP_DAYS) continue;
    counts[idx] += 1;
  }
  return counts.map((n) => toBucket(n));
}
