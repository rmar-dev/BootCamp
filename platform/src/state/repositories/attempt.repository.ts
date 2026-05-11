import { Injectable } from '@nestjs/common';
import { Attempt, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmissionPayload } from '../../content/types/submission-payload.types';

export type CreateAttemptInput = {
  id: string;
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  submissionPayload: SubmissionPayload;
  passed: boolean;
  hintsUsedCount: number;
  failedAttemptsBefore: number;
  pointsAwarded: number;
};

@Injectable()
export class AttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAttemptInput): Promise<Attempt> {
    return this.prisma.attempt.create({
      data: {
        id: input.id,
        studentId: input.studentId,
        exerciseId: input.exerciseId,
        exerciseVersion: input.exerciseVersion,
        submissionPayload:
          input.submissionPayload as unknown as Prisma.InputJsonValue,
        passed: input.passed,
        hintsUsedCount: input.hintsUsedCount,
        failedAttemptsBefore: input.failedAttemptsBefore,
        pointsAwarded: input.pointsAwarded,
      },
    });
  }

  async countByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<number> {
    return this.prisma.attempt.count({
      where: { studentId, exerciseId },
    });
  }

  async countFailedByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<number> {
    return this.prisma.attempt.count({
      where: { studentId, exerciseId, passed: false },
    });
  }

  async listByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<Attempt[]> {
    return this.prisma.attempt.findMany({
      where: { studentId, exerciseId },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async listSubmissionDatesByStudent(studentId: string): Promise<Date[]> {
    const attempts = await this.prisma.attempt.findMany({
      where: { studentId },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    });
    return attempts.map((a) => a.submittedAt);
  }
}
