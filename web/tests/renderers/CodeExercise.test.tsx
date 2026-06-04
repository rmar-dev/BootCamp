import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeExercise } from '@/components/lesson/renderers/CodeExercise';
import type { ExerciseDTO } from '@/lib/exercise-payloads';

vi.mock('@/lib/run', () => ({
  runExercise: vi.fn(),
}));
import { runExercise } from '@/lib/run';

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
  id: 'e', version: 1, type: 'code',
  promptMarkdown: 'Greet', pointsMax: 100,
  attemptStatus: 'unattempted',
  payload: {
    type: 'code', language: 'swift',
    starterCode: 'func greet() -> String {}',
    testCode: '', testEntryPoint: 'greet',
  },
};

describe('CodeExercise', () => {
  beforeEach(() => {
    vi.mocked(runExercise).mockReset();
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
  });

  it('renders Monaco with starterCode', () => {
    render(<CodeExercise exercise={ex} />);
    expect((screen.getByTestId('monaco') as HTMLTextAreaElement).value).toBe('func greet() -> String {}');
  });

  it('has enabled Run and Submit buttons', () => {
    render(<CodeExercise exercise={ex} />);
    expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('calls runExercise and shows result', async () => {
    vi.mocked(runExercise).mockResolvedValue({
      outcome: 'passed', passed: true, stdout: 'ok\n', stderr: '',
      durationMs: 100, timedOut: false,
    });
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    await user.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => expect(screen.getByText(/tests passed/i)).toBeInTheDocument());
    expect(runExercise).toHaveBeenCalledWith('e', 1, 'func greet() -> String {}');
  });

  it('calls submitExercise and shows PointsBadge', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 150,
      outcome: 'passed', stdout: 'ok\n', stderr: '',
      attemptId: 'att-1', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/\+50 points/i)).toBeInTheDocument());
    expect(submitExercise).toHaveBeenCalledWith('e', 1, { code: 'func greet() -> String {}' });
  });

  it('shows loading state', async () => {
    let resolve!: (v: any) => void;
    vi.mocked(runExercise).mockImplementation(() => new Promise(r => { resolve = r; }));
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    await user.click(screen.getByRole('button', { name: /run/i }));
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled();
    resolve({ outcome: 'passed', passed: true, stdout: '', stderr: '', durationMs: 0, timedOut: false });
    await waitFor(() => expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled());
  });

  it('shows "Sign in to run code" when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    await user.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() =>
      expect(screen.getByText(/sign in to run code/i)).toBeInTheDocument(),
    );
    expect(runExercise).not.toHaveBeenCalled();
  });

  it('shows "Sign in to submit" when user is null and submit clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, refresh: vi.fn(), logout: vi.fn(), setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0 });
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() =>
      expect(screen.getByText(/sign in to submit/i)).toBeInTheDocument(),
    );
    expect(submitExercise).not.toHaveBeenCalled();
  });

  it('calls onAttempt with newAttemptStatus on passing Submit', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 50, totalPointsExercise: 100, totalPoints: 150,
      outcome: 'passed', stdout: 'ok\n', stderr: '',
      attemptId: 'att-2', newAttemptStatus: 'first_try',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/\+50 points/i)).toBeInTheDocument());
    expect(onAttempt).toHaveBeenCalledWith('first_try');
  });

  it('does not call onAttempt on failing Submit', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: false, pointsAwarded: 0, totalPointsExercise: 100, totalPoints: 100,
      outcome: 'failed', stdout: '', stderr: 'assertion failed',
      attemptId: 'att-3', newAttemptStatus: 'unattempted',
    });
    const onAttempt = vi.fn();
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} onAttempt={onAttempt} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/0 points this attempt/i)).toBeInTheDocument());
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('shows the empty-state output prompt before any run', () => {
    render(<CodeExercise exercise={ex} />);
    expect(screen.getByText(/press run to see the output/i)).toBeInTheDocument();
  });

  it('replaces the empty-state prompt with the run result after Run', async () => {
    vi.mocked(runExercise).mockResolvedValue({
      outcome: 'passed', passed: true, stdout: 'ok\n', stderr: '',
      durationMs: 12, timedOut: false,
    });
    const user = userEvent.setup();
    render(<CodeExercise exercise={ex} />);
    expect(screen.getByText(/press run to see the output/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => expect(screen.getByText(/tests passed/i)).toBeInTheDocument());
    expect(screen.queryByText(/press run to see the output/i)).not.toBeInTheDocument();
  });

  it('hides the Hint button entirely when no hints are authored', () => {
    render(<CodeExercise exercise={ex} />);
    expect(screen.queryByRole('button', { name: /^hint$/i })).not.toBeInTheDocument();
  });

  it('reveals hints one at a time when the Hint button is clicked', async () => {
    const withHints: ExerciseDTO = {
      ...ex,
      hints: ['Use string interpolation.', 'Don\'t forget the exclamation mark.'],
    };
    const user = userEvent.setup();
    render(<CodeExercise exercise={withHints} />);
    const hintBtn = screen.getByRole('button', { name: /^hint$/i });
    expect(screen.queryByText(/Use string interpolation/)).not.toBeInTheDocument();

    await user.click(hintBtn);
    expect(screen.getByText(/Use string interpolation/)).toBeInTheDocument();
    expect(screen.queryByText(/exclamation mark/)).not.toBeInTheDocument();

    await user.click(hintBtn);
    expect(screen.getByText(/exclamation mark/)).toBeInTheDocument();
  });

  it('disables the Hint button once every hint has been revealed', async () => {
    const withHints: ExerciseDTO = { ...ex, hints: ['Only hint.'] };
    const user = userEvent.setup();
    render(<CodeExercise exercise={withHints} />);
    const hintBtn = screen.getByRole('button', { name: /^hint$/i });
    await user.click(hintBtn);
    expect(hintBtn).toBeDisabled();
  });

  it('Reset clears any revealed hints back to zero', async () => {
    const withHints: ExerciseDTO = { ...ex, hints: ['First hint.'] };
    const user = userEvent.setup();
    render(<CodeExercise exercise={withHints} />);
    await user.click(screen.getByRole('button', { name: /^hint$/i }));
    expect(screen.getByText(/First hint/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.queryByText(/First hint/)).not.toBeInTheDocument();
  });
});

// ── fix_bug payload variant — same renderer ──────────────────────────────────
// CodeExercise is now the single renderer for both `code` and `fix_bug`. These
// tests cover the bits unique to fix_bug: reading `brokenCode` instead of
// `starterCode`, the buggy-tone badge, and the buggy filename in the tab.

describe('CodeExercise — fix_bug variant', () => {
  const fixBugEx: ExerciseDTO = {
    id: 'fb', version: 1, type: 'fix_bug',
    promptMarkdown: 'Fix it', pointsMax: 100,
    attemptStatus: 'unattempted',
    payload: {
      type: 'fix_bug', language: 'swift',
      brokenCode: 'func add(_ a: Int, _ b: Int) -> Int { return a - b }',
      testCode: '', testEntryPoint: 'add',
    },
  };

  beforeEach(() => {
    vi.mocked(runExercise).mockReset();
    vi.mocked(submitExercise).mockReset();
    mockSetTotalPoints.mockReset();
    vi.mocked(useAuth).mockReturnValue({
      user: loggedInUser, loading: false, refresh: vi.fn(), logout: vi.fn(),
      setTotalPoints: mockSetTotalPoints, totalPoints: 0, streak: 0,
    });
  });

  it('seeds the editor from `brokenCode` (not `starterCode`)', () => {
    render(<CodeExercise exercise={fixBugEx} />);
    expect((screen.getByTestId('monaco') as HTMLTextAreaElement).value)
      .toBe('func add(_ a: Int, _ b: Int) -> Int { return a - b }');
  });

  it('renders a "buggy" badge in the editor toolbar', () => {
    render(<CodeExercise exercise={fixBugEx} />);
    expect(screen.getByText(/^buggy$/i)).toBeInTheDocument();
  });

  it('does not render a "buggy" badge for plain `code` payloads', () => {
    render(<CodeExercise exercise={ex} />);
    expect(screen.queryByText(/^buggy$/i)).not.toBeInTheDocument();
  });

  it('uses the buggy filename in the tab', () => {
    render(<CodeExercise exercise={fixBugEx} />);
    expect(screen.getByText('buggy.swift')).toBeInTheDocument();
  });

  it('uses the kotlin buggy filename when language is kotlin', () => {
    const kotlinFix: ExerciseDTO = {
      ...fixBugEx,
      payload: { ...fixBugEx.payload, language: 'kotlin' } as ExerciseDTO['payload'],
    };
    render(<CodeExercise exercise={kotlinFix} />);
    expect(screen.getByText('Buggy.kt')).toBeInTheDocument();
  });

  it('Reset restores the brokenCode (not the starter)', async () => {
    const user = userEvent.setup();
    render(<CodeExercise exercise={fixBugEx} />);
    await user.click(screen.getByRole('button', { name: /^reset$/i }));
    expect((screen.getByTestId('monaco') as HTMLTextAreaElement).value)
      .toBe('func add(_ a: Int, _ b: Int) -> Int { return a - b }');
  });

  it('runs and submits the (mutated) code via the same wire calls', async () => {
    vi.mocked(submitExercise).mockResolvedValue({
      passed: true, pointsAwarded: 75, totalPointsExercise: 100, totalPoints: 175,
      outcome: 'passed', stdout: '', stderr: '',
      attemptId: 'att-fix', newAttemptStatus: 'first_try',
    });
    const user = userEvent.setup();
    render(<CodeExercise exercise={fixBugEx} />);
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText(/\+75 points/i)).toBeInTheDocument());
    expect(submitExercise).toHaveBeenCalledWith('fb', 1, {
      code: 'func add(_ a: Int, _ b: Int) -> Int { return a - b }',
    });
  });
});
