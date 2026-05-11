import { Injectable } from '@nestjs/common';
import { HelpAnchorKind, HelpMessage, HelpRequest, HelpRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateHelpRequestInput = {
  studentId: string;
  instructorId: string;
  anchorKind: HelpAnchorKind;
  anchorId: string;
  title: string;
};

export type CreateHelpMessageInput = {
  helpRequestId: string;
  authorId: string;
  body: string;
};

export type HelpRequestWithMessages = HelpRequest & { messages: HelpMessage[] };

@Injectable()
export class HelpRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateHelpRequestInput): Promise<HelpRequest> {
    return this.prisma.helpRequest.create({ data: input });
  }

  async findById(id: string): Promise<HelpRequest | null> {
    return this.prisma.helpRequest.findUnique({ where: { id } });
  }

  async findByIdWithMessages(id: string): Promise<HelpRequestWithMessages | null> {
    return this.prisma.helpRequest.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  /**
   * Instructor inbox query. Returns the open + answered requests for an
   * instructor, ordered newest-first. Resolved requests are excluded by
   * default — pass `includeResolved: true` for the history view.
   *
   * Backed by the `(instructorId, status)` index from P1.
   */
  async findInbox(
    instructorUserId: string,
    opts: { includeResolved?: boolean; status?: HelpRequestStatus } = {},
  ): Promise<HelpRequest[]> {
    const where: { instructorId: string; status?: HelpRequestStatus | { not: HelpRequestStatus } } =
      {
        instructorId: instructorUserId,
      };
    if (opts.status) {
      where.status = opts.status;
    } else if (!opts.includeResolved) {
      where.status = { not: HelpRequestStatus.resolved };
    }
    return this.prisma.helpRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStudent(studentId: string): Promise<HelpRequest[]> {
    return this.prisma.helpRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setStatus(id: string, status: HelpRequestStatus): Promise<HelpRequest> {
    return this.prisma.helpRequest.update({
      where: { id },
      data: {
        status,
        ...(status === HelpRequestStatus.resolved ? { resolvedAt: new Date() } : {}),
      },
    });
  }

  async appendMessage(input: CreateHelpMessageInput): Promise<HelpMessage> {
    return this.prisma.helpMessage.create({ data: input });
  }
}
