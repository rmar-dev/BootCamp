import { describe, it, expect } from 'vitest';
import { leaderboardSchema } from '@/lib/leaderboard.zod';

describe('leaderboardSchema', () => {
  it('accepts a fully-formed cohort-scoped payload', () => {
    const payload = {
      period: 'weekly',
      entries: [{
        rank: 1, studentId: 's-1', name: 'Maya', initials: 'M',
        language: 'swift', totalPoints: 1240, streak: 5, isMe: false,
      }],
      myRank: 1,
      myLeague: { name: 'Sapphire', xpToNext: 800, nextLeague: 'Peacock' },
      scope: 'cohort',
      cohortName: 'Spring2026',
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });

  it('accepts global scope with null cohortName', () => {
    const payload = {
      period: 'all-time', entries: [], myRank: null,
      myLeague: { name: 'Bronze', xpToNext: 300, nextLeague: 'Silver' },
      scope: 'global', cohortName: null,
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });

  it('rejects unknown period values', () => {
    const payload = { period: 'lifetime', entries: [], myRank: null, myLeague: null, scope: 'global', cohortName: null };
    expect(() => leaderboardSchema.parse(payload)).toThrow();
  });

  it('accepts top-tier myLeague with nextLeague: null and xpToNext: 0', () => {
    const payload = {
      period: 'weekly', entries: [], myRank: null,
      myLeague: { name: 'Peacock', xpToNext: 0, nextLeague: null },
      scope: 'global', cohortName: null,
    };
    expect(() => leaderboardSchema.parse(payload)).not.toThrow();
  });
});
