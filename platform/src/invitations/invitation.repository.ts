import { Injectable } from '@nestjs/common';
import { Invitation, InvitationStatus, UserRole } from '@prisma/client';
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

  create(input: CreateInvitationInput): Promise<Invitation> {
    return this.prisma.invitation.create({ data: { ...input, status: 'pending' } });
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

  setStatus(id: string, status: InvitationStatus, acceptedAt?: Date): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: { status, ...(acceptedAt ? { acceptedAt } : {}) },
    });
  }
}
