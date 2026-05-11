import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InstructorReview } from '@/components/lesson/renderers/InstructorReview';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'student' } }),
}));

describe('InstructorReview', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('renders nothing when attemptId is null', () => {
    const { container } = render(<InstructorReview attemptId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no instructor review exists (404)', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const { container } = render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => {
      expect(container.querySelector('.prose')).toBeNull();
    });
  });

  it('renders review markdown when instructor review exists', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'rev-1',
        attemptId: 'att-1',
        instructorId: 'instr-1',
        markdown: 'Great solution!',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        messages: [],
      }),
    });
    render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => expect(screen.getByText('Great solution!')).toBeInTheDocument());
    expect(screen.getByText('Instructor Review')).toBeInTheDocument();
  });

  it('renders thread messages', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'rev-1',
        attemptId: 'att-1',
        instructorId: 'instr-1',
        markdown: 'Review text',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        messages: [
          { id: 'msg-1', authorId: 'user-1', body: 'Can you explain?', createdAt: '2026-01-02' },
          { id: 'msg-2', authorId: 'instr-1', body: 'Sure, here is more detail.', createdAt: '2026-01-03' },
        ],
      }),
    });
    render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => expect(screen.getByText('Can you explain?')).toBeInTheDocument());
    expect(screen.getByText('Sure, here is more detail.')).toBeInTheDocument();
  });
});
