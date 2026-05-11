import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueTable } from '@/components/instructor/QueueTable';

const pending = [
  {
    attemptId: 'att-1',
    studentName: 'Alice',
    studentEmail: 'alice@test.com',
    exerciseId: 'ex-1',
    exercisePrompt: 'Write a function',
    lessonTitle: 'Intro to Swift',
    submittedAt: '2026-01-01',
    reviewedAt: null,
  },
];

const reviewed = [
  {
    attemptId: 'att-2',
    studentName: 'Bob',
    studentEmail: 'bob@test.com',
    exerciseId: 'ex-2',
    exercisePrompt: 'Fix the bug',
    lessonTitle: 'Debugging',
    submittedAt: '2026-01-02',
    reviewedAt: '2026-01-03',
  },
];

describe('QueueTable', () => {
  it('shows pending tab by default with correct count', () => {
    render(<QueueTable pending={pending} reviewed={reviewed} />);
    expect(screen.getByText('Pending (1)')).toBeInTheDocument();
    expect(screen.getByText('Reviewed (1)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('switches to reviewed tab on click', () => {
    render(<QueueTable pending={pending} reviewed={reviewed} />);
    fireEvent.click(screen.getByText('Reviewed (1)'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty message when no pending items', () => {
    render(<QueueTable pending={[]} reviewed={[]} />);
    expect(screen.getByText('No submissions waiting for review.')).toBeInTheDocument();
  });
});
