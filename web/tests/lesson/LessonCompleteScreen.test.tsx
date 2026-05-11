import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonCompleteScreen } from '@/components/lesson/player/LessonCompleteScreen';

describe('LessonCompleteScreen', () => {
  it('renders regular variant with hex summary and next-lesson button when present', async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(
      <LessonCompleteScreen
        variant="regular"
        hexStates={['first_try', 'eventual', 'first_try']}
        nextLessonId="l-2"
        onNextLesson={onNext}
        onBackToTrack={onBack}
      />,
    );
    expect(screen.getByText(/Lesson complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /next lesson/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('renders pool_complete variant with FreshExercises action', async () => {
    const onFresh = vi.fn();
    render(
      <LessonCompleteScreen
        variant="pool_complete"
        hexStates={['first_try']}
        onFreshExercises={onFresh}
        onBackToTrack={() => {}}
      />,
    );
    expect(screen.getByText(/Pool complete/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /fresh exercises/i }));
    expect(onFresh).toHaveBeenCalled();
  });

  it('omits next-lesson button when nextLessonId is absent', () => {
    render(
      <LessonCompleteScreen
        variant="regular"
        hexStates={[]}
        onBackToTrack={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /next lesson/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to track/i })).toBeInTheDocument();
  });

  it('renders fresh-exercises error message when provided', () => {
    render(
      <LessonCompleteScreen
        variant="pool_complete"
        hexStates={['first_try']}
        onFreshExercises={() => {}}
        onBackToTrack={() => {}}
        freshErrorMessage="revisit failed: 503"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/revisit failed: 503/i);
    expect(alert).toHaveTextContent(/Could not refresh/i);
  });
});
