import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpNextList } from '@/components/dashboard/UpNextList';
import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';
import type { TodayPlan } from '@/lib/gamification';

const TRACK: TrackDetail = {
  id: 't1', version: 1, title: 'Swift', language: 'swift', kind: 'language',
  description: '', lessonCount: 6, starterRepoUrl: null,
  lessons: [
    { id: 'L1', version: 1, title: 'Optionals',  level: 'foundation',  summary: '', position: 1 },
    { id: 'L2', version: 1, title: 'Closures',   level: 'foundation',  summary: '', position: 2 },
    { id: 'L3', version: 1, title: 'State',      level: 'foundation',  summary: '', position: 3 },
    { id: 'L4', version: 1, title: 'Bindings',   level: 'foundation',  summary: '', position: 4 },
    { id: 'L5', version: 1, title: 'Navigation', level: 'foundation',  summary: '', position: 5 },
    { id: 'L6', version: 1, title: 'Animations', level: 'intermediate', summary: '', position: 6 },
  ],
};

const PROGRESS: TrackProgress = {
  trackId: 't1',
  lessons: [
    { lessonId: 'L1', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete', lastAttemptAt: '2026-04-30T12:00:00Z' },
    { lessonId: 'L2', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete', lastAttemptAt: '2026-05-01T12:00:00Z' },
    { lessonId: 'L3', lessonVersion: 1, totalExercises: 4, passedExercises: 2, attemptedExercises: 3, state: 'in_progress', lastAttemptAt: '2026-05-02T08:00:00Z' },
  ],
};

const TODAY_PLAN: TodayPlan = {
  lessonId: 'L3', lessonVersion: 1, trackId: 't1', trackTitle: 'Swift', title: 'State', position: 3,
  estimatedMinutes: 6, typeLabel: 'Concept + quiz',
  recommendationKind: 'continue', reasonMessage: '', conceptHint: null,
};

describe('UpNextList', () => {
  it('renders L3..L6 as the next four (skipping completed L1, L2)', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={TODAY_PLAN} accentColor="red" />);
    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByText('Bindings')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Animations')).toBeInTheDocument();
    expect(screen.queryByText('Optionals')).not.toBeInTheDocument();
  });

  it('first row gets the "Next" badge', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={TODAY_PLAN} accentColor="red" />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('falls back to first-not-complete when todayPlan is null', () => {
    render(<UpNextList track={TRACK} progress={PROGRESS} todayPlan={null} accentColor="red" />);
    expect(screen.getByText('State')).toBeInTheDocument();          // L3 first not-complete
    expect(screen.queryByText('Optionals')).not.toBeInTheDocument();
  });

  it('renders empty-state copy when no candidates remain', () => {
    const allComplete: TrackProgress = {
      trackId: 't1',
      lessons: TRACK.lessons.map((l) => ({
        lessonId: l.id, lessonVersion: 1, totalExercises: 4, passedExercises: 4,
        attemptedExercises: 4, state: 'complete' as const, lastAttemptAt: '2026-05-01T00:00:00Z',
      })),
    };
    render(<UpNextList track={TRACK} progress={allComplete} todayPlan={null} accentColor="red" />);
    expect(screen.getByText(/No upcoming lessons/i)).toBeInTheDocument();
  });

  it('handles undefined progress (treats no lessons as complete)', () => {
    render(<UpNextList track={TRACK} progress={undefined} todayPlan={null} accentColor="red" />);
    // All 6 lessons appear as candidates; we render the first 4
    expect(screen.getByText('Optionals')).toBeInTheDocument();
    expect(screen.getByText('Bindings')).toBeInTheDocument();
    expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
  });
});
