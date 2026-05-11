import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '@/components/ui/Avatar';

describe('Avatar', () => {
  it('renders initials inside .avatar', () => {
    const { container } = render(<Avatar initials="JK" />);
    expect(container.firstChild).toHaveClass('avatar');
    expect(screen.getByText('JK')).toBeTruthy();
  });
  it('size="sm" adds .avatar-sm; size="lg" adds .avatar-lg', () => {
    const { container, rerender } = render(<Avatar initials="A" size="sm" />);
    expect(container.firstChild).toHaveClass('avatar-sm');
    rerender(<Avatar initials="A" size="lg" />);
    expect(container.firstChild).toHaveClass('avatar-lg');
  });
  it('renders <img> when src is provided', () => {
    const { container } = render(<Avatar src="/u.png" alt="me" />);
    expect(container.querySelector('img')).not.toBeNull();
  });
});
