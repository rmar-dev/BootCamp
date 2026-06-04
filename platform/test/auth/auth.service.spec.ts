import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../../src/auth/auth.service';
import { hashInviteToken } from '../../src/invitations/invitation.token';

function makeUsers() {
  const store = new Map<string, any>();
  return {
    async create(input: any) {
      const u = {
        id: input.id, email: input.email, name: input.name,
        passwordHash: input.passwordHash ?? null, role: input.role,
        googleId: input.googleId ?? null, status: input.status ?? 'active',
        createdAt: new Date(),
      };
      store.set(u.id, u);
      return u;
    },
    async findByEmail(email: string) {
      return [...store.values()].find((u) => u.email === email) ?? null;
    },
    async findById(id: string) {
      return store.get(id) ?? null;
    },
    async activate(id: string, passwordHash: string) {
      const u = store.get(id);
      if (!u || u.status !== 'invited') return null;
      const up = { ...u, passwordHash, status: 'active' };
      store.set(id, up);
      return up;
    },
    async setStatus(id: string, status: string) {
      const u = store.get(id);
      const up = { ...u, status };
      store.set(id, up);
      return up;
    },
    _store: store,
  };
}

function makeInvitations() {
  const store = new Map<string, any>();
  return {
    async findByTokenHash(hash: string) {
      return [...store.values()].find((i) => i.tokenHash === hash) ?? null;
    },
    async markAcceptedIfPending(id: string, acceptedAt: Date) {
      const i = store.get(id);
      if (!i || i.status !== 'pending') return false;
      store.set(id, { ...i, status: 'accepted', acceptedAt });
      return true;
    },
    async setStatus(id: string, status: string, acceptedAt?: Date) {
      const i = store.get(id);
      const up = { ...i, status, ...(acceptedAt ? { acceptedAt } : {}) };
      store.set(id, up);
      return up;
    },
    _store: store,
  };
}

function makeService() {
  const users = makeUsers();
  const invitations = makeInvitations();
  const svc = new AuthService(
    users as any,
    invitations as any,
    'test-jwt-secret',
    'test-refresh-secret',
  );
  return { svc, users, invitations };
}

function seedUser(users: any, over: any = {}) {
  const u = {
    id: 'u1', email: 'ivy@test.com', name: 'Ivy', passwordHash: null,
    role: 'instructor', googleId: null, status: 'invited', createdAt: new Date(), ...over,
  };
  users._store.set(u.id, u);
  return u;
}

function seedInvitation(invitations: any, rawToken: string, over: any = {}) {
  const i = {
    id: 'inv1', email: 'ivy@test.com', userId: 'u1', invitedById: 'admin',
    role: 'instructor', tokenHash: hashInviteToken(rawToken), status: 'pending',
    expiresAt: new Date(Date.now() + 60000), acceptedAt: null, createdAt: new Date(), ...over,
  };
  invitations._store.set(i.id, i);
  return i;
}

describe('AuthService.acceptInvite', () => {
  it('rejects an unknown token with BadRequest', async () => {
    const { svc } = makeService();
    await expect(svc.acceptInvite('nope', 'password123')).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired invitation', async () => {
    const { svc, users, invitations } = makeService();
    seedUser(users);
    seedInvitation(invitations, 'rawtoken', { expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.acceptInvite('rawtoken', 'password123')).rejects.toThrow(BadRequestException);
  });

  it('rejects a non-pending invitation', async () => {
    const { svc, users, invitations } = makeService();
    seedUser(users);
    seedInvitation(invitations, 'rawtoken', { status: 'revoked' });
    await expect(svc.acceptInvite('rawtoken', 'password123')).rejects.toThrow(BadRequestException);
  });

  it('activates the user, sets password, marks accepted, returns tokens', async () => {
    const { svc, users, invitations } = makeService();
    seedUser(users);
    seedInvitation(invitations, 'rawtoken');
    const res = await svc.acceptInvite('rawtoken', 'password123');
    expect(res.user.id).toBe('u1');
    expect(res.user.status).toBe('active');
    expect(res.accessToken).toBeTruthy();
    expect(users._store.get('u1').passwordHash).toBeTruthy();
    expect(invitations._store.get('inv1').status).toBe('accepted');
  });

  it('is single-use: a second accept with the same token is rejected', async () => {
    const { svc, users, invitations } = makeService();
    seedUser(users);
    seedInvitation(invitations, 'rawtoken');
    await svc.acceptInvite('rawtoken', 'password123');
    await expect(svc.acceptInvite('rawtoken', 'password123')).rejects.toThrow(BadRequestException);
  });
});

describe('AuthService.login (status gate)', () => {
  async function seedActive(users: any, status = 'active') {
    users._store.set('u2', {
      id: 'u2', email: 'bob@test.com', name: 'Bob',
      passwordHash: await bcrypt.hash('password123', 10),
      role: 'instructor', googleId: null, status, createdAt: new Date(),
    });
  }

  it('returns tokens for an active user with the right password', async () => {
    const { svc, users } = makeService();
    await seedActive(users);
    const res = await svc.login('bob@test.com', 'password123');
    expect(res.user.email).toBe('bob@test.com');
    expect(res.accessToken).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    const { svc, users } = makeService();
    await seedActive(users);
    await expect(svc.login('bob@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invited (not yet activated) user', async () => {
    const { svc, users } = makeService();
    await seedActive(users, 'invited');
    await expect(svc.login('bob@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a disabled user', async () => {
    const { svc, users } = makeService();
    await seedActive(users, 'disabled');
    await expect(svc.login('bob@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown user', async () => {
    const { svc } = makeService();
    await expect(svc.login('nobody@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService.refresh (status gate)', () => {
  it('returns a new access token for an active user', async () => {
    const { svc, users } = makeService();
    users._store.set('u5', {
      id: 'u5', email: 'carol@test.com', name: 'Carol', passwordHash: 'x',
      role: 'instructor', googleId: null, status: 'active', createdAt: new Date(),
    });
    const rt = jwt.sign({ sub: 'u5', email: 'carol@test.com' }, 'test-refresh-secret', { expiresIn: '7d' });
    const res = await svc.refresh(rt);
    expect(res.user.email).toBe('carol@test.com');
  });

  it('rejects an invalid refresh token', async () => {
    const { svc } = makeService();
    await expect(svc.refresh('bad.token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects refresh for a disabled user', async () => {
    const { svc, users } = makeService();
    users._store.set('u6', {
      id: 'u6', email: 'dis@test.com', name: 'D', passwordHash: 'x',
      role: 'instructor', googleId: null, status: 'disabled', createdAt: new Date(),
    });
    const rt = jwt.sign({ sub: 'u6', email: 'dis@test.com' }, 'test-refresh-secret', { expiresIn: '7d' });
    await expect(svc.refresh(rt)).rejects.toThrow(UnauthorizedException);
  });
});
