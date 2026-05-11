import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapstoneSubmissionExercise } from '@/components/lesson/renderers/CapstoneSubmissionExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

vi.mock('@/lib/submit', () => ({
  submitExercise: vi.fn(),
}));
import { submitExercise } from '@/lib/submit';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'student' }, setTotalPoints: vi.fn() }),
}));

const exercise: ExerciseDTO = {
  id: 'ex-1', version: 1, type: 'capstone_submission',
  promptMarkdown: 'Submit milestone.', pointsMax: 50,
  attemptStatus: 'unattempted',
  payload: { type: 'capstone_submission' },
};

describe('CapstoneSubmissionExercise', () => {
  it('renders repo URL, commit SHA, and notes fields', () => {
    render(<CapstoneSubmissionExercise exercise={exercise} />);
    expect(screen.getByPlaceholderText(/github\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/abc1234/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/build output/i)).toBeInTheDocument();
  });

  it('renders Submit Milestone button disabled when empty', () => {
    render(<CapstoneSubmissionExercise exercise={exercise} />);
    expect(screen.getByText('Submit Milestone')).toBeDisabled();
  });

  it('does not call onAttempt even when submission succeeds', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 0, totalPoints: 0,
      attemptId: 'att-1', newAttemptStatus: 'unattempted',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<CapstoneSubmissionExercise exercise={exercise} onAttempt={onAttempt} />);
    await user.type(screen.getByPlaceholderText(/github\.com/i), 'https://github.com/me/proj');
    await user.type(screen.getByPlaceholderText(/abc1234/i), 'abc1234');
    await user.click(screen.getByRole('button', { name: /submit milestone/i }));
    await waitFor(() => expect(submitExercise).toHaveBeenCalled());
    expect(onAttempt).not.toHaveBeenCalled();
  });
});
