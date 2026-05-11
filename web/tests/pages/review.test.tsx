import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReviewPage from '@/app/(authed)/(shell)/review/page';

vi.mock('@/lib/review', () => ({
  fetchReviewQueue: vi.fn(),
  submitReview: vi.fn(),
}));

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: any) => <div>{children}</div>,
}));

// Minimal mocks for the review renderers
vi.mock('@/components/review/ReviewMultipleChoice', () => ({
  ReviewMultipleChoice: ({ onSubmit }: any) => (
    <button data-testid="mc-submit" onClick={() => onSubmit({ selectedOptionIds: ['a'] })}>
      MC submit
    </button>
  ),
}));
vi.mock('@/components/review/ReviewFillBlank', () => ({
  ReviewFillBlank: () => <div data-testid="fb">FB</div>,
}));
vi.mock('@/components/review/ReviewPredictOutput', () => ({
  ReviewPredictOutput: () => <div data-testid="po">PO</div>,
}));

import { fetchReviewQueue, submitReview } from '@/lib/review';

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReviewPage', () => {
  it('renders the empty-queue completion state when no cards are due', async () => {
    (fetchReviewQueue as any).mockResolvedValue({ due: [] });

    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    });
  });

  it('advances from card 1 to card 2 after a successful submit', async () => {
    (fetchReviewQueue as any).mockResolvedValue({
      due: [
        { cardId: 'c1', exerciseId: 'e1', step: 1, dueAt: '2026-04-20T10:00:00Z',
          exercise: { id: 'e1', version: 1, type: 'multiple_choice',
            promptMarkdown: 'Card 1', payload: {}, pointsMax: 10 } },
        { cardId: 'c2', exerciseId: 'e2', step: 2, dueAt: '2026-04-21T10:00:00Z',
          exercise: { id: 'e2', version: 1, type: 'multiple_choice',
            promptMarkdown: 'Card 2', payload: {}, pointsMax: 10 } },
      ],
    });
    (submitReview as any).mockResolvedValue({
      passed: true, card: { step: 2, nextDueAt: '2026-05-01', retiredAt: null },
    });

    render(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Card 1')).toBeInTheDocument();
    });
    expect(screen.getByText(/card 1 of 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mc-submit'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Card 2')).toBeInTheDocument();
    });
    expect(screen.getByText(/card 2 of 2/i)).toBeInTheDocument();
    expect(submitReview).toHaveBeenCalledWith('c1', { selectedOptionIds: ['a'] });
  });

  it('shows the completion state after the last card is answered', async () => {
    (fetchReviewQueue as any).mockResolvedValue({
      due: [
        { cardId: 'c1', exerciseId: 'e1', step: 1, dueAt: '2026-04-20T10:00:00Z',
          exercise: { id: 'e1', version: 1, type: 'multiple_choice',
            promptMarkdown: 'Only card', payload: {}, pointsMax: 10 } },
      ],
    });
    (submitReview as any).mockResolvedValue({
      passed: true, card: { step: 2, nextDueAt: '2026-05-01', retiredAt: null },
    });

    render(<ReviewPage />);

    await waitFor(() => expect(screen.getByText('Only card')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mc-submit'));

    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/all done/i)).toBeInTheDocument();
    });
  });
});
