import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PathsList } from '@/components/dashboard/PathsList';
import type { TrackSummary } from '@/lib/tracks';
import type { TrackProgress } from '@/lib/progress';

const TRACKS: TrackSummary[] = [
  { id: 'swift', version: 1, title: 'SwiftUI fundamentals', language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null },
  { id: 'kotlin', version: 1, title: 'Compose fundamentals', language: 'kotlin', kind: 'language', description: '', lessonCount: 18, starterRepoUrl: null },
];

const makeProgress = (trackId: string, completeCount: number): TrackProgress => ({
  trackId,
  lessons: Array.from({ length: completeCount }, (_, i) => ({
    lessonId: `${trackId}-${i}`,
    lessonVersion: 1,
    totalExercises: 1,
    passedExercises: 1,
    attemptedExercises: 1,
    state: 'complete' as const,
    lastAttemptAt: '2026-05-01T00:00:00Z',
  })),
});

const PROGRESS = new Map<string, TrackProgress | null>([
  ['swift', makeProgress('swift', 17)],
  ['kotlin', makeProgress('kotlin', 6)],
]);

describe('PathsList', () => {
  it('renders one card per track with correct done/total', () => {
    render(<PathsList tracks={TRACKS} progressByTrack={PROGRESS} />);
    expect(screen.getByText('SwiftUI fundamentals')).toBeInTheDocument();
    expect(screen.getByText('17/24')).toBeInTheDocument();
    expect(screen.getByText('Compose fundamentals')).toBeInTheDocument();
    expect(screen.getByText('6/18')).toBeInTheDocument();
  });

  it('uses iris dot for swift, amber dot for kotlin', () => {
    const { container } = render(<PathsList tracks={TRACKS} progressByTrack={PROGRESS} />);
    const dots = container.querySelectorAll('[data-track-dot]');
    expect(dots[0].getAttribute('data-track-dot')).toBe('iris');
    expect(dots[1].getAttribute('data-track-dot')).toBe('amber');
  });

  it('handles missing progress entry as 0 done', () => {
    const partial = new Map<string, TrackProgress | null>([['swift', PROGRESS.get('swift')!]]);
    render(<PathsList tracks={TRACKS} progressByTrack={partial} />);
    expect(screen.getByText('0/18')).toBeInTheDocument();
  });

  it('renders the section heading "Your paths"', () => {
    render(<PathsList tracks={TRACKS} progressByTrack={PROGRESS} />);
    expect(screen.getByRole('heading', { name: /Your paths/i })).toBeInTheDocument();
  });
});
