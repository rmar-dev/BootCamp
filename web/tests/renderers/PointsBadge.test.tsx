import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PointsBadge } from '@/components/lesson/renderers/PointsBadge';

describe('PointsBadge', () => {
  it('shows +N points on pass', () => {
    render(<PointsBadge passed={true} pointsAwarded={50} totalPoints={150} />);
    expect(screen.getByText('+50 points')).toBeInTheDocument();
    expect(screen.getByText(/150 total/i)).toBeInTheDocument();
  });

  it('shows 0 points on fail', () => {
    render(<PointsBadge passed={false} pointsAwarded={0} totalPoints={100} />);
    expect(screen.getByText(/0 points this attempt/i)).toBeInTheDocument();
    expect(screen.getByText(/100 total/i)).toBeInTheDocument();
  });
});
