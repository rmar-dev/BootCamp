import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarUserPill } from '@/components/shell/SidebarUserPill';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/components/layout/SettingsMenu', () => ({
  SettingsMenu: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="settings-menu" onClick={onClose}>menu</div>
  ),
}));

describe('SidebarUserPill', () => {
  it('returns null when there is no user', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);
    const { container } = render(<SidebarUserPill />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the user info and toggles SettingsMenu on click', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'Jordan Kim', email: 'jordan@bootcamp.dev', role: 'student' },
    } as never);
    render(<SidebarUserPill />);
    expect(screen.getByText('Jordan Kim')).toBeTruthy();
    expect(screen.getByText('jordan@bootcamp.dev')).toBeTruthy();
    expect(screen.queryByTestId('settings-menu')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /jordan kim/i }));
    expect(screen.getByTestId('settings-menu')).toBeTruthy();
  });
});
