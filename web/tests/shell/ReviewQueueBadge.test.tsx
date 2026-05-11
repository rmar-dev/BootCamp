import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ReviewQueueBadge } from '@/components/shell/ReviewQueueBadge';

vi.mock('@/lib/review', () => ({
  fetchReviewQueue: vi.fn(),
}));
import { fetchReviewQueue } from '@/lib/review';

describe('ReviewQueueBadge', () => {
  beforeEach(() => {
    vi.mocked(fetchReviewQueue).mockReset();
  });

  it('renders the count when due queue size > 0', async () => {
    vi.mocked(fetchReviewQueue).mockResolvedValueOnce({ due: [{}, {}, {}] } as never);
    const { container, findByText } = render(<ReviewQueueBadge />);
    await findByText('3');
    expect(container.querySelector('.badge')).not.toBeNull();
  });

  it('renders nothing when due queue size is 0', async () => {
    vi.mocked(fetchReviewQueue).mockResolvedValueOnce({ due: [] } as never);
    const { container } = render(<ReviewQueueBadge />);
    await waitFor(() => expect(fetchReviewQueue).toHaveBeenCalled());
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('renders nothing when fetch fails', async () => {
    vi.mocked(fetchReviewQueue).mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<ReviewQueueBadge />);
    await waitFor(() => expect(fetchReviewQueue).toHaveBeenCalled());
    expect(container.querySelector('.badge')).toBeNull();
  });
});
