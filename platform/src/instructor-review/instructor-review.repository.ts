import { Injectable } from '@nestjs/common';
import { InstructorReview, ReviewMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../shared/ids';

export type CreateInstructorReviewInput = {
  attemptId: string;
  instructorId: string;
  markdown: string;
};

export type InstructorReviewWithMessages = InstructorReview & {
  messages: ReviewMessage[];
};

@Injectable()
export class InstructorReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInstructorReviewInput): Promise<InstructorReview> {
    return this.prisma.instructorReview.create({
      data: {
        id: newId(),
        attemptId: input.attemptId,
        instructorId: input.instructorId,
        markdown: input.markdown,
      },
    });
  }

  async update(id: string, markdown: string): Promise<InstructorReview> {
    return this.prisma.instructorReview.update({
      where: { id },
      data: { markdown },
    });
  }

  async findById(id: string): Promise<InstructorReviewWithMessages | null> {
    return this.prisma.instructorReview.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findByAttemptId(attemptId: string): Promise<InstructorReviewWithMessages | null> {
    return this.prisma.instructorReview.findUnique({
      where: { attemptId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async addMessage(instructorReviewId: string, authorId: string, body: string): Promise<ReviewMessage> {
    return this.prisma.reviewMessage.create({
      data: {
        id: newId(),
        instructorReviewId,
        authorId,
        body,
      },
    });
  }
}
