import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']);

export const heatCell = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
]);

export const profileSchema = z.object({
  account: z.object({
    studentId: z.string().min(1),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
    level: z.number().int().min(1),
  }),
  trackBadges: z.array(z.object({ language, trackTitle: z.string() })),
  kpis: z.object({
    totalPoints: z.number().int().min(0),
    currentStreak: z.number().int().min(0),
    badgesEarned: z.number().int().min(0),
    badgesTotal: z.number().int().min(0),
  }),
  heatStrip: z.array(heatCell).length(182),
  skills: z.array(z.object({
    trackId: z.string().min(1),
    title: z.string(),
    language,
    progressPct: z.number().int().min(0).max(100),
  })),
  badges: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    earned: z.boolean(),
    earnedAt: z.string().optional().nullable(),
  })),
});

export type ProfileResponse = z.infer<typeof profileSchema>;
