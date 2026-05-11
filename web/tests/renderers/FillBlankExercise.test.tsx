import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FillBlankExercise } from '@/components/lesson/renderers/FillBlankExercise';
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
  id: 'e', version: 1, type: 'fill_blank',
  promptMarkdown: 'Fill it', pointsMax: 100,
  attemptStatus: 'unattempted',
  payload: {
    type: 'fill_blank', language: 'swift',
    template: 'let {{name}} = 42',
    blanks: [{ id: 'name', expected: ['x'] }],
  },
};

describe('FillBlankExercise', () => {
  beforeEach(() => {
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
  });

  it('renders the template with a drop slot where the blank is', () => {
    render(<FillBlankExercise exercise={ex} />);
    expect(screen.getByText(/let/)).toBeInTheDocument();
    expect(screen.getByText(/= 42/)).toBeInTheDocument();
    expect(screen.getByLabelText('blank-name')).toBeInTheDocument();
  });

  it('also renders slots for the curriculum-style ___id___ template', () => {
    const curriculumEx: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'func count() -> ___1___ { return 0 }',
        blanks: [{ id: '1', expected: ['Int'] }],
      },
    };
    render(<FillBlankExercise exercise={curriculumEx} />);
    expect(screen.getByLabelText('blank-1')).toBeInTheDocument();
  });

  it('derives the available token pool from blank answers when tokens not set', () => {
    render(<FillBlankExercise exercise={ex} />);
    expect(screen.getByLabelText('token-x')).toBeInTheDocument();
  });

  it('uses the authored tokens pool verbatim (preserving distractors)', () => {
    const authored: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{a}}: {{b}} = 0',
        blanks: [
          { id: 'a', expected: ['count'] },
          { id: 'b', expected: ['Int'] },
        ],
        tokens: ['count', 'Int', 'String', 'var', 'let'],
      },
    };
    render(<FillBlankExercise exercise={authored} />);
    expect(screen.getByLabelText('token-count')).toBeInTheDocument();
    expect(screen.getByLabelText('token-Int')).toBeInTheDocument();
    expect(screen.getByLabelText('token-String')).toBeInTheDocument();
    expect(screen.getByLabelText('token-var')).toBeInTheDocument();
    expect(screen.getByLabelText('token-let')).toBeInTheDocument();
  });

  it('places a token into the next empty slot when clicked', async () => {
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.click(screen.getByLabelText('token-x'));
    const slot = screen.getByLabelText('blank-name');
    expect(slot).toHaveClass('filled');
    expect(slot).toHaveTextContent('x');
  });

  it('returns a token to the pool when the filled slot is clicked', async () => {
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.click(screen.getByLabelText('token-x'));
    expect(screen.getByLabelText('blank-name')).toHaveClass('filled');
    await user.click(screen.getByLabelText('blank-name'));
    expect(screen.getByLabelText('blank-name')).not.toHaveClass('filled');
  });

  it('keeps the Submit button disabled until every blank is filled', async () => {
    const twoBlanks: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{a}} = {{b}}',
        blanks: [
          { id: 'a', expected: ['x'] },
          { id: 'b', expected: ['1'] },
        ],
        tokens: ['x', '1'],
      },
    };
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={twoBlanks} />);
    const submit = screen.getByRole('button', { name: /^submit$/i });
    expect(submit).toBeDisabled();
    await user.click(screen.getByLabelText('token-x'));
    expect(submit).toBeDisabled();
    await user.click(screen.getByLabelText('token-1'));
    expect(submit).toBeEnabled();
  });

  it('submits the placed-token mapping as the answer', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 50,
      attemptId: 'att-1', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.click(screen.getByLabelText('token-x'));
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByText(/correct/i)).toBeInTheDocument());
    expect(submitExercise).toHaveBeenCalledWith('e', 1, { answer: { name: 'x' } });
    expect(screen.getByText(/\+50 points/i)).toBeInTheDocument();
  });

  it('shows wrong-state styling on the slots when the submission fails', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 0,
      attemptId: 'att-2', newAttemptStatus: 'unattempted',
    });
    const wrongEx: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{name}} = 42',
        blanks: [{ id: 'name', expected: ['x'] }],
        tokens: ['x', 'wrong'],
      },
    };
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={wrongEx} />);
    await user.click(screen.getByLabelText('token-wrong'));
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(screen.getByLabelText('blank-name')).toHaveClass('wrong');
  });

  it('shows "Sign in to submit" when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.click(screen.getByLabelText('token-x'));
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
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
    render(<FillBlankExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByLabelText('token-x'));
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
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
    render(<FillBlankExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByLabelText('token-x'));
    await user.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(screen.getByText(/not quite/i)).toBeInTheDocument());
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('marks tokens and slots draggable while interactive', () => {
    render(<FillBlankExercise exercise={ex} />);
    const token = screen.getByLabelText('token-x');
    expect(token).toHaveAttribute('draggable', 'true');
    // Empty slots are not draggable — only filled ones can be moved.
    expect(screen.getByLabelText('blank-name')).toHaveAttribute('draggable', 'false');
  });

  it('drops a dragged pool token onto the slot it was dropped on (not the next-empty)', async () => {
    const twoBlanks: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{a}} = {{b}}',
        blanks: [
          { id: 'a', expected: ['x'] },
          { id: 'b', expected: ['1'] },
        ],
        tokens: ['x', '1'],
      },
    };
    render(<FillBlankExercise exercise={twoBlanks} />);
    const token = screen.getByLabelText('token-1');
    const slotA = screen.getByLabelText('blank-a');
    const slotB = screen.getByLabelText('blank-b');

    fireEvent.dragStart(token);
    fireEvent.dragOver(slotB);
    fireEvent.drop(slotB);

    // Click-to-place would have filled slot A first; drop must respect the drop target.
    expect(slotA).not.toHaveClass('filled');
    expect(slotB).toHaveClass('filled');
    expect(slotB).toHaveTextContent('1');
  });

  it('swaps two slot tokens when one is dragged onto the other', async () => {
    const user = userEvent.setup();
    const twoBlanks: ExerciseDTO = {
      ...ex,
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{a}} = {{b}}',
        blanks: [
          { id: 'a', expected: ['x'] },
          { id: 'b', expected: ['1'] },
        ],
        tokens: ['x', '1'],
      },
    };
    render(<FillBlankExercise exercise={twoBlanks} />);
    // Click-to-place puts tokens in order: x → a, 1 → b.
    await user.click(screen.getByLabelText('token-x'));
    await user.click(screen.getByLabelText('token-1'));

    const slotA = screen.getByLabelText('blank-a');
    const slotB = screen.getByLabelText('blank-b');
    expect(slotA).toHaveTextContent('x');
    expect(slotB).toHaveTextContent('1');

    // Drag slotA's token onto slotB → should swap.
    fireEvent.dragStart(slotA);
    fireEvent.dragOver(slotB);
    fireEvent.drop(slotB);

    expect(screen.getByLabelText('blank-a')).toHaveTextContent('1');
    expect(screen.getByLabelText('blank-b')).toHaveTextContent('x');
  });

  it('returns a token to the pool when the slot is dragged onto the pool area', async () => {
    const user = userEvent.setup();
    render(<FillBlankExercise exercise={ex} />);
    await user.click(screen.getByLabelText('token-x'));
    expect(screen.getByLabelText('blank-name')).toHaveClass('filled');

    const slot = screen.getByLabelText('blank-name');
    const pool = screen.getByRole('list', { name: /available tokens/i });
    fireEvent.dragStart(slot);
    fireEvent.dragOver(pool);
    fireEvent.drop(pool);

    expect(screen.getByLabelText('blank-name')).not.toHaveClass('filled');
    expect(screen.getByLabelText('token-x')).not.toHaveClass('used');
  });

  it('cancels drag visuals on dragEnd', () => {
    render(<FillBlankExercise exercise={ex} />);
    const token = screen.getByLabelText('token-x');
    fireEvent.dragStart(token);
    expect(token).toHaveClass('dragging');
    fireEvent.dragEnd(token);
    expect(token).not.toHaveClass('dragging');
  });

  it('rehydrates assignments from a previously saved response', () => {
    const resumed: ExerciseDTO = {
      ...ex,
      lastResponse: { answer: { name: 'x' } },
      payload: {
        type: 'fill_blank', language: 'swift',
        template: 'let {{name}} = 42',
        blanks: [{ id: 'name', expected: ['x'] }],
        tokens: ['x', 'y'],
      },
    };
    render(<FillBlankExercise exercise={resumed} />);
    expect(screen.getByLabelText('blank-name')).toHaveClass('filled');
    expect(screen.getByLabelText('blank-name')).toHaveTextContent('x');
    // The matching pool token should be flagged used.
    expect(screen.getByLabelText('token-x')).toHaveClass('used');
    expect(screen.getByLabelText('token-y')).not.toHaveClass('used');
  });
});
