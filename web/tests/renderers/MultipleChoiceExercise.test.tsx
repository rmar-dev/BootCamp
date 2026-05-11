import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultipleChoiceExercise } from '@/components/lesson/renderers/MultipleChoiceExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

vi.mock('@/lib/submit', () => ({
  submitExercise: vi.fn(),
}));
import { submitExercise } from '@/lib/submit';

const loggedInUser = { id: '1', email: 'a@b.com', name: 'A', role: 'student' as const, googleId: null, createdAt: '' };
const mockSetTotalPoints = vi.fn();

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 })),
}));
import { useAuth } from '@/components/layout/AuthProvider';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'multiple_choice',
  promptMarkdown: 'Pick one', pointsMax: 100,
  attemptStatus: 'unattempted',
  payload: {
    type: 'multiple_choice', questionMarkdown: 'Which letter?',
    options: [{ id: 'a', text: 'Apple' }, { id: 'b', text: 'Banana' }],
    correctOptionIds: ['a'], multiSelect: false,
  },
};

describe('MultipleChoiceExercise', () => {
  beforeEach(() => {
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
  });

  it('renders the question and options', () => {
    render(<MultipleChoiceExercise exercise={ex} />);
    expect(screen.getByText('Which letter?')).toBeInTheDocument();
    expect(screen.getByLabelText('Apple')).toBeInTheDocument();
    expect(screen.getByLabelText('Banana')).toBeInTheDocument();
  });

  it('calls submitExercise with correct args and shows correct state on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 150,
      attemptId: 'att-1', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByLabelText('Apple'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    expect(submitExercise).toHaveBeenCalledWith('e', 1, { answer: ['a'] });
    expect(screen.getByText(/\+50 points/i)).toBeInTheDocument();
  });

  it('shows incorrect state and PointsBadge when wrong answer is submitted', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 100,
      attemptId: 'att-2', newAttemptStatus: 'unattempted',
    });
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByLabelText('Banana'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(screen.getByText(/0 points this attempt/i)).toBeInTheDocument();
  });

  it('shows "Sign in to submit" when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);
    await user.click(screen.getByLabelText('Apple'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/sign in to submit/i)).toBeInTheDocument());
    expect(submitExercise).not.toHaveBeenCalled();
  });

  it('calls onAttempt with newAttemptStatus on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 150,
      attemptId: 'att-3', newAttemptStatus: 'first_try',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByLabelText('Apple'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    expect(onAttempt).toHaveBeenCalledWith('first_try');
  });

  it('does not call onAttempt on fail', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 100,
      attemptId: 'att-4', newAttemptStatus: 'unattempted',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByLabelText('Banana'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('lets the learner change their selection and re-submit after a wrong answer', async () => {
    vi.mocked(submitExercise)
      .mockResolvedValueOnce({
        passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 100,
        attemptId: 'att-wrong', newAttemptStatus: 'unattempted',
      })
      .mockResolvedValueOnce({
        passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 150,
        attemptId: 'att-right', newAttemptStatus: 'eventual',
      });

    const user = userEvent.setup();
    render(<MultipleChoiceExercise exercise={ex} />);

    // First attempt — wrong.
    await user.click(screen.getByLabelText('Banana'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());

    // The inputs must NOT be disabled — learner needs to be able to retry.
    expect(screen.getByLabelText('Apple')).not.toBeDisabled();
    expect(screen.getByLabelText('Banana')).not.toBeDisabled();

    // Switch selection to the correct option and re-submit.
    await user.click(screen.getByLabelText('Apple'));
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());

    expect(submitExercise).toHaveBeenCalledTimes(2);
    expect(submitExercise).toHaveBeenNthCalledWith(1, 'e', 1, { answer: ['b'] });
    expect(submitExercise).toHaveBeenNthCalledWith(2, 'e', 1, { answer: ['a'] });
  });
});
