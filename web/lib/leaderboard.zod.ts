import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']).nullable();
const period = z.enum(['weekly', 'monthly', 'all-time']);
const leagueName = z.enum(['Bronze', 'Silver', 'Gold', 'Sapphire', 'Peacock']);

export const leaderboardSchema = z.object({
  period,
  entries: z.array(z.object({
    rank: z.number().int().min(1),
    studentId: z.string().min(1),
    name: z.string(),
    initials: z.string(),
    language,
    totalPoints: z.number().int().min(0),
    streak: z.number().int().min(0),
    isMe: z.boolean(),
  })),
  myRank: z.number().int().nullable(),
  myLeague: z.object({
    name: leagueName,
    xpToNext: z.number().int().min(0),
    nextLeague: leagueName.nullable(),
  }).nullable(),
  scope: z.enum(['cohort', 'global']),
  cohortName: z.string().nullable(),
});

export type LeaderboardPeriod = z.infer<typeof period>;
export type LeaderboardResponse = z.infer<typeof leaderboardSchema>;
export type LeaderboardEntry = LeaderboardResponse['entries'][number];
