import { Injectable } from '@nestjs/common';
import { ProjectRating } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertRatingInput = {
  attemptId: string;
  raterUserId: string;
  score: number;
  comment: string;
};

@Injectable()
export class ProjectRatingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Multi-rater: zero-or-many rows per attempt. Unique on
   * (attemptId, raterUserId) so a given rater updates rather than
   * duplicates. Backed by the unique index from P1.
   */
  async upsert(input: UpsertRatingInput): Promise<ProjectRating> {
    return this.prisma.projectRating.upsert({
      where: {
        attemptId_raterUserId: {
          attemptId: input.attemptId,
          raterUserId: input.raterUserId,
        },
      },
      update: { score: input.score, comment: input.comment },
      create: {
        attemptId: input.attemptId,
        raterUserId: input.raterUserId,
        score: input.score,
        comment: input.comment,
      },
    });
  }

  /**
   * Public read — every rating attached to an attempt, ordered newest-first.
   * Used by the student-facing review page (multi-rater list with assigned
   * primary) and by the instructor rating queue.
   */
  async findByAttempt(attemptId: string): Promise<ProjectRating[]> {
    return this.prisma.projectRating.findMany({
      where: { attemptId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<ProjectRating | null> {
    return this.prisma.projectRating.findUnique({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.projectRating.delete({ where: { id } });
  }
}
