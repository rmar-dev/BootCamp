import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarNavItem } from '@/components/shell/SidebarNavItem';

describe('SidebarNavItem', () => {
  it('renders an anchor when href is provided', () => {
    render(<SidebarNavItem icon="home" label="Dashboard" href="/dashboard" />);
    const link = screen.getByRole('link', { name: /dashboard/i });
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders a button and fires onClick when onClick is provided (no href)', async () => {
    const onClick = vi.fn();
    render(<SidebarNavItem icon="play" label="Continue lesson" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /continue lesson/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('emits .side-link.active when active', () => {
    const { container } = render(<SidebarNavItem icon="home" label="X" href="/x" active />);
    expect(container.firstChild).toHaveClass('side-link', 'active');
  });

  it('renders an icon with .side-icon class', () => {
    const { container } = render(<SidebarNavItem icon="home" label="X" href="/x" />);
    expect(container.querySelector('svg.side-icon')).not.toBeNull();
  });

  it('renders a badge slot when badge is provided', () => {
    render(
      <SidebarNavItem icon="refresh" label="Review" href="/review" badge={<span data-testid="badge">3</span>} />,
    );
    expect(screen.getByTestId('badge')).toBeTruthy();
  });
});
