import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeagueBadge } from '@/components/leaderboard/LeagueBadge';

describe('LeagueBadge', () => {
  it('shows "Currently in <name>" with xpToNext when nextLeague exists', () => {
    render(<LeagueBadge league={{ name: 'Sapphire', xpToNext: 800, nextLeague: 'Peacock' }} />);
    expect(screen.getByText(/Currently in Sapphire/i)).toBeInTheDocument();
    expect(screen.getByText(/800 XP to Peacock/i)).toBeInTheDocument();
  });

  it('omits "X XP to next" copy at top tier', () => {
    render(<LeagueBadge league={{ name: 'Peacock', xpToNext: 0, nextLeague: null }} />);
    expect(screen.getByText(/Currently in Peacock/i)).toBeInTheDocument();
    expect(screen.queryByText(/XP to/i)).not.toBeInTheDocument();
  });

  it('renders nothing when league is null', () => {
    const { container } = render(<LeagueBadge league={null} />);
    expect(container.firstChild).toBeNull();
  });
});
