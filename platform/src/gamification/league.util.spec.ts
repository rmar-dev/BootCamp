import { describe, it, expect } from '@jest/globals';
import { deriveLeague } from './league.util';

describe('deriveLeague', () => {
  it('returns Bronze for level 1-2 with xpToNext to Silver', () => {
    expect(deriveLeague(1, 0)).toEqual({ name: 'Bronze', xpToNext: 300, nextLeague: 'Silver' });
    expect(deriveLeague(2, 100)).toEqual({ name: 'Bronze', xpToNext: 200, nextLeague: 'Silver' });
  });

  it('returns Silver for level 3-4', () => {
    expect(deriveLeague(3, 300)).toEqual({ name: 'Silver', xpToNext: 700, nextLeague: 'Gold' });
    expect(deriveLeague(4, 600)).toEqual({ name: 'Silver', xpToNext: 400, nextLeague: 'Gold' });
  });

  it('returns Gold for level 5-6', () => {
    expect(deriveLeague(5, 1000)).toEqual({ name: 'Gold', xpToNext: 1100, nextLeague: 'Sapphire' });
    expect(deriveLeague(6, 1500)).toEqual({ name: 'Gold', xpToNext: 600, nextLeague: 'Sapphire' });
  });

  it('returns Sapphire for level 7-9', () => {
    expect(deriveLeague(7, 2100)).toEqual({ name: 'Sapphire', xpToNext: 2400, nextLeague: 'Peacock' });
    expect(deriveLeague(9, 3600)).toEqual({ name: 'Sapphire', xpToNext: 900, nextLeague: 'Peacock' });
  });

  it('returns Peacock for level 10+, top tier with xpToNext = 0 and nextLeague = null', () => {
    expect(deriveLeague(10, 4500)).toEqual({ name: 'Peacock', xpToNext: 0, nextLeague: null });
    expect(deriveLeague(15, 9000)).toEqual({ name: 'Peacock', xpToNext: 0, nextLeague: null });
  });

  it('clamps negative xpToNext to 0 when totalPoints already exceeds the next-tier minXP', () => {
    // Edge: a student at level 4 with 1500 XP (would normally be level 6).
    // The level passed in is authoritative; if the points overshoot the next tier, xpToNext clamps to 0.
    expect(deriveLeague(4, 1500)).toEqual({ name: 'Silver', xpToNext: 0, nextLeague: 'Gold' });
  });
});
