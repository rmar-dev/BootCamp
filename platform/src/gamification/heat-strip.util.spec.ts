// src/gamification/heat-strip.util.spec.ts
import { describe, it, expect } from '@jest/globals';
import {
  buildHeatStrip,
  HEAT_STRIP_DAYS,
  startOfHeatStrip,
} from './heat-strip.util';

describe('startOfHeatStrip', () => {
  it('returns 26*7 - 1 days before now at UTC midnight', () => {
    const now = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));
    const start = startOfHeatStrip(now);
    const expected = new Date(Date.UTC(2026, 4, 6, 0, 0, 0));
    expected.setUTCDate(expected.getUTCDate() - (HEAT_STRIP_DAYS - 1));
    expect(start).toEqual(expected);
  });
});

describe('buildHeatStrip', () => {
  const now = new Date(Date.UTC(2026, 4, 6, 14, 30, 0));
  const start = startOfHeatStrip(now);

  it('returns 182 zeros for empty input', () => {
    const cells = buildHeatStrip([], start);
    expect(cells).toHaveLength(182);
    expect(cells.every((v) => v === 0)).toBe(true);
  });

  it('places a single attempt on the correct day', () => {
    // 5 days before today → day index 176 (since today is index 181).
    const ts = new Date(now);
    ts.setUTCDate(ts.getUTCDate() - 5);
    const cells = buildHeatStrip([{ submittedAt: ts }], start);
    expect(cells[176]).toBe(1);
    expect(cells[175]).toBe(0);
    expect(cells[177]).toBe(0);
  });

  it('buckets multiple attempts on the same day', () => {
    const ts = new Date(now);
    ts.setUTCDate(ts.getUTCDate() - 1);
    const events = Array.from({ length: 5 }, () => ({ submittedAt: ts }));
    const cells = buildHeatStrip(events, start);
    // 5 activities → bucket 3
    expect(cells[180]).toBe(3);
  });

  it('drops attempts before the window', () => {
    const tooOld = new Date(start);
    tooOld.setUTCDate(tooOld.getUTCDate() - 1);
    const cells = buildHeatStrip([{ submittedAt: tooOld }], start);
    expect(cells.every((v) => v === 0)).toBe(true);
  });

  it('places an attempt on the first day of the window correctly', () => {
    const cells = buildHeatStrip([{ submittedAt: start }], start);
    expect(cells[0]).toBe(1);
  });
});
