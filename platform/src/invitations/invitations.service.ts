import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invitation, UserRole } from '@prisma/client';
import { newId } from '../shared/ids';
import { UserRepository } from '../auth/user.repository';
import { StudentRepository } from '../state/repositories/student.repository';
import { InvitationRepository } from './invitation.repository';
import { generateInviteToken, hashInviteToken } from './invitation.token';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type Caller = { userId: string; role: string };
export type IssueInput = { email: string; name: string; role: UserRole };
export type IssueResult = {
  invitation: Invitation;
  token: string; // raw token — returned ONCE, never persisted
  acceptUrlPath: string;
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly students: StudentRepository,
  ) {}

  /**
   * Issue an invite. The granted role is decided by the CALLER's role, never
   * by client input: an instructor can only ever mint a `student` (linked to
   * themselves); only an admin may mint `instructor`/`admin`.
   */
  async issue(input: IssueInput, caller: Caller): Promise<IssueResult> {
    const grantedRole: UserRole =
      caller.role === 'admin' ? input.role : UserRole.student;

    const existing = await this.users.findByEmail(input.email);
    if (existing && existing.status === 'active') {
      throw new BadRequestException('A user with this email already exists');
    }
    if (existing) {
      throw new BadRequestException(
        'This email already has a pending invitation; revoke it first',
      );
    }

    const user = await this.users.create({
      id: newId(),
      email: input.email,
      name: input.name,
      role: grantedRole,
      status: 'invited',
    });

    // A student invite auto-links the new student to the inviting instructor
    // (or to nobody when an admin issues it — admins aren't instructors of record).
    if (grantedRole === UserRole.student) {
      await this.students.create({
        id: newId(),
        name: input.name,
        email: input.email,
        userId: user.id,
        instructorId: caller.role === 'instructor' ? caller.userId : null,
      });
    }

    const token = generateInviteToken();
    const invitation = await this.invitations.create({
      id: newId(),
      email: input.email,
      userId: user.id,
      invitedById: caller.userId,
      role: grantedRole,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    return { invitation, token, acceptUrlPath: `/accept-invite?token=${token}` };
  }

  async list(caller: Caller): Promise<Invitation[]> {
    return this.invitations.findForInviter(caller.role === 'admin' ? null : caller.userId);
  }

  async revoke(id: string, caller: Caller): Promise<void> {
    const invitation = await this.invitations.findById(id);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (caller.role !== 'admin' && invitation.invitedById !== caller.userId) {
      throw new ForbiddenException('You can only revoke invitations you issued');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException('Only a pending invitation can be revoked');
    }
    await this.users.setStatus(invitation.userId, 'disabled');
    await this.invitations.setStatus(id, 'revoked');
  }
}
