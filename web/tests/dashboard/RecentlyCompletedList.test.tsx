import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecentlyCompletedList } from '@/components/dashboard/RecentlyCompletedList';
import type { TrackDetail } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';

const TRACK: TrackDetail = {
  id: 't1', version: 1, title: 'Swift', language: 'swift', kind: 'language',
  description: '', lessonCount: 4, starterRepoUrl: null,
  lessons: [
    { id: 'L1', version: 1, title: 'Optionals', level: 'foundation', summary: '', position: 1 },
    { id: 'L2', version: 1, title: 'Closures',  level: 'foundation', summary: '', position: 2 },
    { id: 'L3', version: 1, title: 'State',     level: 'foundation', summary: '', position: 3 },
    { id: 'L4', version: 1, title: 'Bindings',  level: 'foundation', summary: '', position: 4 },
  ],
};

const PROGRESS: TrackProgress = {
  trackId: 't1',
  lessons: [
    { lessonId: 'L1', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete', lastAttemptAt: '2026-04-28T12:00:00Z' },
    { lessonId: 'L2', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete', lastAttemptAt: '2026-04-30T12:00:00Z' },
    { lessonId: 'L3', lessonVersion: 1, totalExercises: 4, passedExercises: 4, attemptedExercises: 4, state: 'complete', lastAttemptAt: '2026-05-01T12:00:00Z' },
    { lessonId: 'L4', lessonVersion: 1, totalExercises: 4, passedExercises: 0, attemptedExercises: 0, state: 'not_started', lastAttemptAt: null },
  ],
};

describe('RecentlyCompletedList', () => {
  it('renders last 3 completed lessons sorted by lastAttemptAt desc', () => {
    render(<RecentlyCompletedList track={TRACK} progress={PROGRESS} />);
    const items = screen.getAllByRole('link');
    expect(items[0]).toHaveTextContent('State');
    expect(items[1]).toHaveTextContent('Closures');
    expect(items[2]).toHaveTextContent('Optionals');
  });

  it('renders empty-state when none completed', () => {
    const empty: TrackProgress = { trackId: 't1', lessons: [] };
    render(<RecentlyCompletedList track={TRACK} progress={empty} />);
    expect(screen.getByText(/Nothing completed yet/i)).toBeInTheDocument();
  });

  it('renders empty-state when progress is undefined', () => {
    render(<RecentlyCompletedList track={TRACK} progress={undefined} />);
    expect(screen.getByText(/Nothing completed yet/i)).toBeInTheDocument();
  });
});
