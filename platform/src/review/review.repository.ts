import { Injectable } from '@nestjs/common';
import { CodeReview } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../shared/ids';

export type CreateReviewInput = {
  attemptId: string;
  studentId: string;
  markdown: string;
};

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReviewInput): Promise<CodeReview> {
    return this.prisma.codeReview.create({
      data: {
        id: newId(),
        attemptId: input.attemptId,
        studentId: input.studentId,
        markdown: input.markdown,
      },
    });
  }

  async findByAttemptId(attemptId: string): Promise<CodeReview | null> {
    return this.prisma.codeReview.findUnique({ where: { attemptId } });
  }
}
