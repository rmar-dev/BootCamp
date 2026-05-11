import type { DashboardData } from '@/lib/gamification';

export const dashboardContinueFixture: DashboardData = {
  streak: 12,
  streakIncrementedToday: true,
  badges: [
    { id: 'first-lesson', name: 'First lesson', description: 'Complete your first lesson', icon: '🎯', earned: true, earnedAt: '2026-04-15T10:00:00Z' },
    { id: 'week-streak', name: '7-day streak', description: 'Practice 7 days in a row', icon: '🔥', earned: true },
    { id: 'concept-master', name: 'Concept master', description: 'Pass every exercise in a concept', icon: '🧠', earned: false },
  ],
  rank: 7,
  totalPoints: 1240,
  pointsEarnedToday: 18,
  dailyXp: { earned: 18, target: 20 },
  mastery: { level: 4, xpInLevel: 640, xpForNextLevel: 360 },
  todayPlan: {
    lessonId: 'lesson-state-bindings',
    lessonVersion: 1,
    trackId: 'track-swift',
    trackTitle: 'iOS Development with SwiftUI',
    title: 'State, Bindings, and the @State property wrapper',
    position: 8,
    estimatedMinutes: 6,
    typeLabel: 'Concept + quiz',
    recommendationKind: 'continue',
    reasonMessage: 'pick up where you left off',
    conceptHint: null,
  },
};

export const dashboardExhaustedFixture: DashboardData = {
  ...dashboardContinueFixture,
  streakIncrementedToday: false,
  todayPlan: null,
};

export const dashboardConceptGapFixture: DashboardData = {
  ...dashboardContinueFixture,
  todayPlan: {
    ...dashboardContinueFixture.todayPlan!,
    title: 'Optionals revisited',
    recommendationKind: 'concept_gap',
    reasonMessage: "Practice optionals — you've passed 2/5 so far.",
    conceptHint: 'optionals',
  },
};
