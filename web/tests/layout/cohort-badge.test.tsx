import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CohortBadge } from '@/components/layout/CohortBadge';

describe('CohortBadge', () => {
  it('renders "4-week cohort" for four_week', () => {
    render(<CohortBadge cohortLength="four_week" />);
    expect(screen.getByText(/4-week cohort/i)).toBeDefined();
  });
  it('renders "12-week cohort" for twelve_week', () => {
    render(<CohortBadge cohortLength="twelve_week" />);
    expect(screen.getByText(/12-week cohort/i)).toBeDefined();
  });
  it('renders nothing for null', () => {
    const { container } = render(<CohortBadge cohortLength={null} />);
    expect(container.firstChild).toBeNull();
  });
});
