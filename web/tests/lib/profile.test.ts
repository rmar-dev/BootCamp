import { describe, it, expect } from 'vitest';
import { profileSchema } from '@/lib/profile.zod';

const validPayload = () => ({
  account: { studentId: 's-1', name: 'Test', email: 't@x.com', createdAt: new Date().toISOString(), level: 3 },
  trackBadges: [{ language: 'swift', trackTitle: 'Swift Fundamentals' }],
  kpis: { totalPoints: 1240, currentStreak: 5, badgesEarned: 3, badgesTotal: 18 },
  heatStrip: Array.from({ length: 182 }, () => 0),
  skills: [{ trackId: 't-1', title: 'Swift Fundamentals', language: 'swift', progressPct: 80 }],
  badges: [],
});

describe('profileSchema', () => {
  it('accepts a fully-formed payload', () => {
    expect(() => profileSchema.parse(validPayload())).not.toThrow();
  });

  it('rejects heatStrip of wrong length', () => {
    const payload = { ...validPayload(), heatStrip: [1, 2, 3] };
    expect(() => profileSchema.parse(payload)).toThrow();
  });

  it('rejects invalid heat-cell values (must be 0-4)', () => {
    const heatStrip = Array.from({ length: 182 }, () => 5 as unknown as number);
    const payload = { ...validPayload(), heatStrip };
    expect(() => profileSchema.parse(payload)).toThrow();
  });
});
