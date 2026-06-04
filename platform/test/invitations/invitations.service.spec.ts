import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from '../../src/invitations/invitations.service';

function build() {
  const invitations = {
    create: jest.fn(),
    findForInviter: jest.fn(),
    findById: jest.fn(),
    findPendingByEmail: jest.fn(),
    setStatus: jest.fn(),
  };
  const users = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    setStatus: jest.fn(),
  };
  const students = { create: jest.fn() };
  const svc = new InvitationsService(invitations as any, users as any, students as any);
  return { svc, invitations, users, students };
}

const ADMIN = { userId: 'admin-1', role: 'admin' };
const INSTRUCTOR = { userId: 'inst-1', role: 'instructor' };

describe('InvitationsService.issue', () => {
  it('admin can invite an instructor; returns the raw token once', async () => {
    const { svc, users, invitations } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u-new', email: 'i@x.com', role: 'instructor' });
    invitations.create.mockImplementation(async (i: any) => i);

    const res = await svc.issue({ email: 'i@x.com', name: 'Ivy', role: 'instructor' }, ADMIN);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'i@x.com', role: 'instructor', status: 'invited' }),
    );
    expect(res.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.acceptUrlPath).toBe(`/accept-invite?token=${res.token}`);
  });

  it('instructor inviting forces role=student and links the student to themselves', async () => {
    const { svc, users, students } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u-stu', email: 's@x.com', role: 'student' });

    await svc.issue({ email: 's@x.com', name: 'Sam', role: 'instructor' /* spoofed */ }, INSTRUCTOR);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student', status: 'invited' }),
    );
    expect(students.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-stu', email: 's@x.com', instructorId: 'inst-1' }),
    );
  });

  it('instructor cannot mint an instructor (role is forced, never elevated)', async () => {
    const { svc, users } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u', email: 's@x.com', role: 'student' });
    await svc.issue({ email: 's@x.com', name: 'S', role: 'admin' }, INSTRUCTOR);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'student' }));
  });

  it('admin issuing a student invite does NOT link an instructor (instructorId null)', async () => {
    const { svc, users, students } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u-stu', email: 's2@x.com', role: 'student' });
    await svc.issue({ email: 's2@x.com', name: 'S2', role: 'student' }, ADMIN);
    expect(students.create).toHaveBeenCalledWith(
      expect.objectContaining({ instructorId: null }),
    );
  });

  it('rejects inviting an already-active email', async () => {
    const { svc, users } = build();
    users.findByEmail.mockResolvedValue({ id: 'u', email: 'a@x.com', status: 'active' });
    await expect(svc.issue({ email: 'a@x.com', name: 'A', role: 'instructor' }, ADMIN))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inviting an email that already has a pending (invited) user', async () => {
    const { svc, users } = build();
    users.findByEmail.mockResolvedValue({ id: 'u', email: 'a@x.com', status: 'invited' });
    await expect(svc.issue({ email: 'a@x.com', name: 'A', role: 'instructor' }, ADMIN))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvitationsService.revoke', () => {
  it('instructor can revoke only their own invite', async () => {
    const { svc, invitations, users } = build();
    invitations.findById.mockResolvedValue({ id: 'inv', invitedById: 'someone-else', userId: 'u', status: 'pending' });
    await expect(svc.revoke('inv', INSTRUCTOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.setStatus).not.toHaveBeenCalled();
  });

  it('revoking disables the pending user and marks the invite revoked', async () => {
    const { svc, invitations, users } = build();
    invitations.findById.mockResolvedValue({ id: 'inv', invitedById: 'inst-1', userId: 'u', status: 'pending' });
    await svc.revoke('inv', INSTRUCTOR);
    expect(users.setStatus).toHaveBeenCalledWith('u', 'disabled');
    expect(invitations.setStatus).toHaveBeenCalledWith('inv', 'revoked');
  });

  it('revoke throws NotFound for a missing invite', async () => {
    const { svc, invitations } = build();
    invitations.findById.mockResolvedValue(null);
    await expect(svc.revoke('nope', ADMIN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('revoke rejects a non-pending invite', async () => {
    const { svc, invitations } = build();
    invitations.findById.mockResolvedValue({ id: 'inv', invitedById: 'admin-1', userId: 'u', status: 'accepted' });
    await expect(svc.revoke('inv', ADMIN)).rejects.toBeInstanceOf(BadRequestException);
  });
});
