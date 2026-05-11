import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsMenu } from '@/components/layout/SettingsMenu';

const setTheme = vi.fn();
const setDensity = vi.fn();

vi.mock('@/lib/tweaks', () => ({
  useTweaks: () => ({ theme: 'system', density: 'comfortable', setTheme, setDensity }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const logout = vi.fn();
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({
    user: { name: 'Jordan Kim', email: 'jordan@bootcamp.dev', role: 'student' },
    logout,
  }),
}));

describe('SettingsMenu', () => {
  beforeEach(() => {
    setTheme.mockClear();
    setDensity.mockClear();
    logout.mockClear();
  });

  it('renders Appearance and Density sections with Account info', () => {
    render(<SettingsMenu />);
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Density')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Jordan Kim')).toBeTruthy();
    expect(screen.getByText('jordan@bootcamp.dev')).toBeTruthy();
    expect(screen.getByText('student')).toBeTruthy();
  });

  it('clicking a theme chip calls setTheme with that mode', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('clicking a density chip calls setDensity with that value', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: 'compact' }));
    expect(setDensity).toHaveBeenCalledWith('compact');
  });

  it('Sign out triggers logout from AuthProvider', async () => {
    render(<SettingsMenu />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(logout).toHaveBeenCalled();
  });
});
