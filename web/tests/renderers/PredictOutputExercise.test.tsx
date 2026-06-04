import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PredictOutputExercise } from '@/components/lesson/renderers/PredictOutputExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

vi.mock('@/lib/submit', () => ({
  submitExercise: vi.fn(),
}));
import { submitExercise } from '@/lib/submit';

const loggedInUser = { id: '1', email: 'a@b.com', name: 'A', role: 'student' as const, status: 'active' as const, googleId: null, createdAt: '' };
const mockSetTotalPoints = vi.fn();

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 })),
}));
import { useAuth } from '@/components/layout/AuthProvider';

const ex: ExerciseDTO = {
  id: 'e', version: 1, type: 'predict_output',
  promptMarkdown: 'What prints?', pointsMax: 100,
  attemptStatus: 'unattempted',
  payload: {
    type: 'predict_output', displayedLanguage: 'swift',
    displayedCode: 'print(2 + 3)', expectedOutput: '5',
  },
};

describe('PredictOutputExercise', () => {
  beforeEach(() => {
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
  });

  it('renders the displayed code', () => {
    render(<PredictOutputExercise exercise={ex} />);
    expect(screen.getByText('print(2 + 3)')).toBeInTheDocument();
  });

  it('calls submitExercise and shows correct state on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 50,
      attemptId: 'att-1', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} />);
    await user.type(screen.getByLabelText(/predicted output/i), '5');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    expect(submitExercise).toHaveBeenCalledWith('e', 1, { answer: '5' });
    expect(screen.getByText(/\+50 points/i)).toBeInTheDocument();
  });

  it('shows incorrect state when wrong prediction submitted', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 0,
      attemptId: 'att-2', newAttemptStatus: 'unattempted',
    });
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} />);
    await user.type(screen.getByLabelText(/predicted output/i), '6');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(screen.getByText(/0 points this attempt/i)).toBeInTheDocument();
  });

  it('shows "Sign in to submit" when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} />);
    await user.type(screen.getByLabelText(/predicted output/i), '5');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/sign in to submit/i)).toBeInTheDocument());
    expect(submitExercise).not.toHaveBeenCalled();
  });

  it('calls onAttempt with newAttemptStatus on pass', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 50,
      attemptId: 'att-3', newAttemptStatus: 'first_try',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} onAttempt={onAttempt} />);
    await user.type(screen.getByLabelText(/predicted output/i), '5');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    expect(onAttempt).toHaveBeenCalledWith('first_try');
  });

  it('does not call onAttempt on fail', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 0,
      attemptId: 'att-4', newAttemptStatus: 'unattempted',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<PredictOutputExercise exercise={ex} onAttempt={onAttempt} />);
    await user.type(screen.getByLabelText(/predicted output/i), '6');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(onAttempt).not.toHaveBeenCalled();
  });
});
