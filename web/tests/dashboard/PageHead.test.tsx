import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageHead } from '@/components/dashboard/PageHead';
import type { TrackDetail } from '@/lib/tracks';
import { dashboardContinueFixture, dashboardExhaustedFixture, dashboardConceptGapFixture } from '@/lib/__fixtures__/dashboard.fixture';

const TRACK: TrackDetail = {
  id: 'track-swift', version: 1, title: 'iOS Development with SwiftUI',
  language: 'swift', kind: 'language', description: '', lessonCount: 24, starterRepoUrl: null,
  lessons: [],
};

describe('PageHead', () => {
  it('renders eyebrow with track title', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByText('iOS Development with SwiftUI')).toBeInTheDocument();
  });

  it('renders heading with first name', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Jordan.');
  });

  it('renders heading without name when user.name is empty', () => {
    render(<PageHead user={{ id: 'u', name: '' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back.');
  });

  it('shows "Continue lesson NN" copy on continue kind', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    expect(screen.getByRole('link', { name: /Continue lesson 8/i })).toBeInTheDocument();
  });

  it('shows "Practice {concept}" copy on concept_gap kind', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardConceptGapFixture} track={TRACK} />);
    expect(screen.getByRole('link', { name: /Practice optionals/i })).toBeInTheDocument();
  });

  it('hides Continue CTA on exhausted state, shows Review CTA', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardExhaustedFixture} track={TRACK} />);
    expect(screen.queryByRole('link', { name: /Continue lesson/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All caught up|Review queue/i })).toBeInTheDocument();
  });

  it('renders disabled "Restart streak insurance" button', () => {
    render(<PageHead user={{ id: 'u', name: 'Jordan Kim' }} dash={dashboardContinueFixture} track={TRACK} />);
    const btn = screen.getByRole('button', { name: /Restart streak insurance/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });
});
