import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeUnlock } from '@/components/lesson/renderers/BadgeUnlock';

describe('BadgeUnlock', () => {
  it('renders badge names and icons when badges are provided', () => {
    const badges = [
      { id: 'b1', name: 'First Submit', icon: '🚀' },
      { id: 'b2', name: 'Streak Master', icon: '🔥' },
    ];
    render(<BadgeUnlock badges={badges} />);
    // Each badge renders a "Badge unlocked" label plus the name
    expect(screen.getAllByText(/Badge unlocked/i)).toHaveLength(2);
    expect(screen.getByText('First Submit')).toBeInTheDocument();
    expect(screen.getByText('Streak Master')).toBeInTheDocument();
    expect(screen.getByText('🚀')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('renders nothing when badges array is empty', () => {
    const { container } = render(<BadgeUnlock badges={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
