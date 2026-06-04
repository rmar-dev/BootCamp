import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { User } from '@prisma/client';
import { newId } from '../../src/shared/ids';

// In-memory mock UserRepository
function makeMockRepo(): UserRepository {
  const store = new Map<string, User>();

  return {
    async create(input: any): Promise<User> {
      if ([...store.values()].some(u => u.email === input.email)) {
        throw { code: 'P2002' };
      }
      if (input.googleId && [...store.values()].some(u => u.googleId === input.googleId)) {
        throw { code: 'P2002' };
      }
      const user: User = {
        id: input.id,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash ?? null,
        role: input.role,
        googleId: input.googleId ?? null,
        status: input.status ?? 'active',
        createdAt: new Date(),
      };
      store.set(user.id, user);
      return user;
    },
    async findByEmail(email: string) {
      return [...store.values()].find(u => u.email === email) ?? null;
    },
    async findById(id: string) {
      return store.get(id) ?? null;
    },
    async findByGoogleId(googleId: string) {
      return [...store.values()].find(u => u.googleId === googleId) ?? null;
    },
    async update(id: string, data: any) {
      const user = store.get(id);
      if (!user) throw new Error('User not found');
      const updated = { ...user, ...data };
      store.set(id, updated);
      return updated;
    },
  } as unknown as UserRepository;
}

function makeService(opts: { domain?: string } = {}): AuthService {
  return new AuthService(
    makeMockRepo(),
    'test-jwt-secret',
    'test-refresh-secret',
    opts.domain ?? '',
  );
}

describe('AuthService', () => {
  describe('register', () => {
    it('registers a new user and returns tokens', async () => {
      const svc = makeService();
      const result = await svc.register('alice@test.com', 'Alice', 'password123');
      expect(result.user.email).toBe('alice@test.com');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('throws ConflictException on duplicate email', async () => {
      const svc = makeService();
      await svc.register('alice@test.com', 'Alice', 'password123');
      await expect(svc.register('alice@test.com', 'Alice2', 'password456')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when email domain does not match', async () => {
      const svc = makeService({ domain: 'allowed.com' });
      await expect(svc.register('alice@other.com', 'Alice', 'password123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const svc = makeService();
      await svc.register('bob@test.com', 'Bob', 'securePass1');
      const result = await svc.login('bob@test.com', 'securePass1');
      expect(result.user.email).toBe('bob@test.com');
      expect(result.accessToken).toBeTruthy();
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const svc = makeService();
      await svc.register('bob@test.com', 'Bob', 'securePass1');
      await expect(svc.login('bob@test.com', 'wrongpass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      const svc = makeService();
      await expect(svc.login('nobody@test.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns new access token on valid refresh token', async () => {
      const svc = makeService();
      const { refreshToken } = await svc.register('carol@test.com', 'Carol', 'pass12345');
      const result = await svc.refresh(refreshToken);
      expect(result.user.email).toBe('carol@test.com');
      expect(result.accessToken).toBeTruthy();
    });

    it('throws UnauthorizedException on invalid refresh token', async () => {
      const svc = makeService();
      await expect(svc.refresh('bad.token.here')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findOrCreateGoogleUser', () => {
    it('creates a new user when no match exists', async () => {
      const svc = makeService();
      const result = await svc.findOrCreateGoogleUser('goog-001', 'dave@test.com', 'Dave');
      expect(result.user.email).toBe('dave@test.com');
      expect(result.user.googleId).toBe('goog-001');
    });

    it('returns existing user when googleId matches', async () => {
      const svc = makeService();
      const first = await svc.findOrCreateGoogleUser('goog-002', 'eve@test.com', 'Eve');
      const second = await svc.findOrCreateGoogleUser('goog-002', 'eve@test.com', 'Eve');
      expect(second.user.id).toBe(first.user.id);
    });

    it('links googleId to existing account by email', async () => {
      const svc = makeService();
      await svc.register('frank@test.com', 'Frank', 'pass12345');
      const result = await svc.findOrCreateGoogleUser('goog-003', 'frank@test.com', 'Frank');
      expect(result.user.googleId).toBe('goog-003');
    });
  });
});
