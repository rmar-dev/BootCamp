import { Injectable } from '@nestjs/common';
import { Invitation, InvitationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateInvitationInput = {
  id: string;
  email: string;
  userId: string;
  invitedById: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInvitationInput, tx?: Prisma.TransactionClient): Promise<Invitation> {
    return (tx ?? this.prisma).invitation.create({ data: { ...input, status: 'pending' } });
  }

  findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { tokenHash } });
  }

  findById(id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { id } });
  }

  /** Admin sees all; instructor sees only invites they issued. */
  findForInviter(invitedById: string | null): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: invitedById ? { invitedById } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Pending invitation for an email that hasn't expired/been used. */
  findPendingByEmail(email: string): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: { email, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  setStatus(id: string, status: InvitationStatus, acceptedAt?: Date, tx?: Prisma.TransactionClient): Promise<Invitation> {
    return (tx ?? this.prisma).invitation.update({
      where: { id },
      data: { status, ...(acceptedAt ? { acceptedAt } : {}) },
    });
  }

  /**
   * Atomically transition pending -> accepted. Returns true only for the ONE
   * caller that wins the race; concurrent duplicates get false. Prevents a
   * magic-link token from being redeemed more than once.
   */
  async markAcceptedIfPending(id: string, acceptedAt: Date, tx?: Prisma.TransactionClient): Promise<boolean> {
    const res = await (tx ?? this.prisma).invitation.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'accepted', acceptedAt },
    });
    return res.count === 1;
  }
}
