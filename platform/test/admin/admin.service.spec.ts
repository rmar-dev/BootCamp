import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../../src/admin/admin.service';

function build() {
  const users = { findAll: jest.fn(), findById: jest.fn(), setRole: jest.fn() };
  const svc = new AdminService(users as any);
  return { svc, users };
}

describe('AdminService.listUsers', () => {
  it('returns users without passwordHash', async () => {
    const { svc, users } = build();
    users.findAll.mockResolvedValue([
      { id: 'u1', email: 'a@x.com', name: 'A', role: 'student', status: 'active', passwordHash: 'secret', googleId: null, createdAt: new Date() },
    ]);
    const res = await svc.listUsers();
    expect(res).toEqual([
      expect.objectContaining({ id: 'u1', email: 'a@x.com', name: 'A', role: 'student', status: 'active' }),
    ]);
    expect((res[0] as any).passwordHash).toBeUndefined();
  });
});

describe('AdminService.changeRole', () => {
  it('rejects an admin changing their OWN role (anti-lockout)', async () => {
    const { svc, users } = build();
    await expect(svc.changeRole('admin-1', 'student', 'admin-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(users.setRole).not.toHaveBeenCalled();
  });

  it('throws NotFound for a missing target user', async () => {
    const { svc, users } = build();
    users.findById.mockResolvedValue(null);
    await expect(svc.changeRole('ghost', 'instructor', 'admin-1'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes the target role and returns the sanitized user', async () => {
    const { svc, users } = build();
    users.findById.mockResolvedValue({ id: 'u2', role: 'student' });
    users.setRole.mockResolvedValue({ id: 'u2', email: 'b@x.com', name: 'B', role: 'instructor', status: 'active', passwordHash: 'h', googleId: null, createdAt: new Date() });
    const res = await svc.changeRole('u2', 'instructor', 'admin-1');
    expect(users.setRole).toHaveBeenCalledWith('u2', 'instructor');
    expect(res).toEqual(expect.objectContaining({ id: 'u2', role: 'instructor' }));
    expect((res as any).passwordHash).toBeUndefined();
  });
});
