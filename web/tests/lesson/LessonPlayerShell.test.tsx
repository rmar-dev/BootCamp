import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonPlayerShell } from '@/components/lesson/LessonPlayerShell';
import type { LessonResponse } from '@/lib/api';

const replace = vi.fn();
const useSearchParams = vi.fn(() => new URLSearchParams(''));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock('@/lib/tracks', () => ({
  fetchTrack: vi.fn(async () => ({
    id: 't-1',
    version: 1,
    title: 'Swift',
    language: 'swift',
    kind: 'core',
    description: '',
    lessonCount: 2,
    starterRepoUrl: null,
    lessons: [
      { id: 'l-1', version: 1, title: 'Lesson 1', level: 'beginner', summary: '', position: 0 },
      { id: 'l-2', version: 1, title: 'Lesson 2', level: 'beginner', summary: '', position: 1 },
    ],
  })),
}));

vi.mock('@/lib/revisit', () => ({
  revisitLesson: vi.fn(async () => ({})),
  PoolCompleteError: class PoolCompleteError extends Error {},
}));

const sampleLesson: LessonResponse = {
  id: 'l-1', version: 1, title: 'Lesson 1', trackId: 't-1', assignment: null,
  blocks: [
    { kind: 'explanation', id: 'b-0', markdown: '# Intro' },
    { kind: 'exercise', id: 'b-1', exercise: {
      id: 'e-1', version: 1, type: 'multiple_choice',
      promptMarkdown: 'pick one', pointsMax: 100,
      // The renderer surfaces `payload.questionMarkdown`, not `promptMarkdown`,
      // so the question text in fixture data must live there for the test to
      // assert on what the user actually sees.
      payload: { type: 'multiple_choice', questionMarkdown: 'pick one', options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      attemptStatus: 'unattempted',
    } },
    { kind: 'exercise', id: 'b-2', exercise: {
      id: 'e-2', version: 1, type: 'multiple_choice',
      promptMarkdown: 'pick one', pointsMax: 100,
      payload: { type: 'multiple_choice', questionMarkdown: 'pick one', options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'], multiSelect: false },
      attemptStatus: 'first_try',
    } },
  ],
};

describe('LessonPlayerShell', () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParams.mockReturnValue(new URLSearchParams(''));
  });

  it('renders step 0 (explanation) by default', () => {
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/Intro/i)).toBeInTheDocument();
  });

  it('reads ?step from the URL', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=1'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/pick one/i)).toBeInTheDocument();
  });

  it('renders the lesson-complete screen when step === blocks.length', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=3'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    expect(screen.getByText(/Lesson complete/i)).toBeInTheDocument();
  });

  it('routes to next step on Continue', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=0'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('step=1'),
      expect.objectContaining({ scroll: false }),
    );
  });

  it('shows hex bar with attemptStatus from each exercise', () => {
    render(<LessonPlayerShell lesson={sampleLesson} />);
    const hexes = document.querySelectorAll('.hex');
    expect(hexes).toHaveLength(2);  // two exercises
    expect(hexes[0]).not.toHaveClass('first_try');  // unattempted
    expect(hexes[1]).toHaveClass('first_try');
  });

  it('renders next-lesson button when track has a successor', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('step=3'));
    render(<LessonPlayerShell lesson={sampleLesson} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /next lesson/i })).toBeInTheDocument(),
    );
  });

  it('hides hex bar for single-exercise capstone lessons', () => {
    const capstoneLesson: LessonResponse = {
      ...sampleLesson,
      blocks: [{ kind: 'exercise', id: 'b-0', exercise: {
        id: 'cap', version: 1, type: 'capstone_submission',
        promptMarkdown: 'submit', pointsMax: 0,
        payload: { type: 'capstone_submission' },
        attemptStatus: 'unattempted',
      } }],
    };
    render(<LessonPlayerShell lesson={capstoneLesson} />);
    expect(document.querySelector('.hex')).toBeNull();
  });
});
