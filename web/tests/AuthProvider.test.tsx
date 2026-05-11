import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/components/layout/AuthProvider';

vi.mock('@/lib/auth', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
}));

import { fetchMe } from '@/lib/auth';

const mockUser = {
  id: '1',
  email: 'alice@example.com',
  name: 'Alice',
  role: 'student' as const,
  googleId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function UserDisplay() {
  const { user, loading } = useAuth();
  if (loading) return <p>loading</p>;
  if (!user) return <p>not logged in</p>;
  return <p>{user.email}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('shows user email when fetchMe returns user', async () => {
    vi.mocked(fetchMe).mockResolvedValue(mockUser);
    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument(),
    );
  });

  it('shows not logged in when fetchMe returns null (401)', async () => {
    vi.mocked(fetchMe).mockResolvedValue(null);
    render(
      <AuthProvider>
        <UserDisplay />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('not logged in')).toBeInTheDocument(),
    );
  });
});
