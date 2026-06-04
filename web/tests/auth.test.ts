import { describe, it, expect, vi, afterEach } from 'vitest';
import { login, fetchMe } from '@/lib/auth';

const mockUser = {
  id: '1',
  email: 'alice@example.com',
  name: 'Alice',
  role: 'student' as const,
  googleId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('login', () => {
  it('returns user on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser }),
    } as Response);

    const user = await login('alice@example.com', 'secret');
    expect(user).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('throws on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_credentials' }),
    } as Response);

    await expect(login('alice@example.com', 'wrong')).rejects.toThrow('invalid_credentials');
  });
});

describe('fetchMe', () => {
  it('returns user on 200', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser }),
    } as Response);

    const user = await fetchMe();
    expect(user).toEqual(mockUser);
  });

  it('returns null on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    } as Response);

    const user = await fetchMe();
    expect(user).toBeNull();
  });
});
