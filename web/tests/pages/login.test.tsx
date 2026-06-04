import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLogin = vi.fn();
vi.mock('@/lib/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

const mockRefresh = vi.fn();
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ refresh: mockRefresh, user: null, loading: false, logout: vi.fn() }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it('renders email, password fields and sign in button', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error message on invalid credentials', async () => {
    mockLogin.mockRejectedValue(new Error('invalid_credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/password/i);
    await user.clear(emailField);
    await user.clear(passwordField);
    await user.type(emailField, 'bad@example.com');
    await user.type(passwordField, 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.'),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to / on successful login', async () => {
    mockLogin.mockResolvedValue({ id: '1', email: 'alice@example.com', name: 'Alice', role: 'student', googleId: null, createdAt: '' });
    mockRefresh.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailField = screen.getByLabelText(/email/i);
    const passwordField = screen.getByLabelText(/password/i);
    await user.clear(emailField);
    await user.clear(passwordField);
    await user.type(emailField, 'alice@example.com');
    await user.type(passwordField, 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
  });
});
