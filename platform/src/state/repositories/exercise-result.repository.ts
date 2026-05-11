import { Injectable } from '@nestjs/common';
import { ExerciseResult } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type UpsertResultInput = {
  id: string;
  studentId: string;
  exerciseId: string;
  bestAttemptId: string;
  passed: boolean;
  pointsEarned: number;
  attemptsCount: number;
  firstPassedAt: Date | null;
};

@Injectable()
export class ExerciseResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudentAndExercise(
    studentId: string,
    exerciseId: string,
  ): Promise<ExerciseResult | null> {
    return this.prisma.exerciseResult.findUnique({
      where: { studentId_exerciseId: { studentId, exerciseId } },
    });
  }

  async upsert(input: UpsertResultInput): Promise<ExerciseResult> {
    return this.prisma.exerciseResult.upsert({
      where: {
        studentId_exerciseId: {
          studentId: input.studentId,
          exerciseId: input.exerciseId,
        },
      },
      create: {
        id: input.id,
        studentId: input.studentId,
        exerciseId: input.exerciseId,
        bestAttemptId: input.bestAttemptId,
        passed: input.passed,
        pointsEarned: input.pointsEarned,
        attemptsCount: input.attemptsCount,
        firstPassedAt: input.firstPassedAt,
      },
      update: {
        bestAttemptId: input.bestAttemptId,
        passed: input.passed,
        pointsEarned: input.pointsEarned,
        attemptsCount: input.attemptsCount,
        firstPassedAt: input.firstPassedAt,
      },
    });
  }

  async listByStudent(studentId: string): Promise<ExerciseResult[]> {
    return this.prisma.exerciseResult.findMany({ where: { studentId } });
  }

  async sumPointsSince(studentId: string, sinceUtc: Date): Promise<number> {
    const agg = await this.prisma.exerciseResult.aggregate({
      where: { studentId, firstPassedAt: { gte: sinceUtc } },
      _sum: { pointsEarned: true },
    });
    return agg._sum.pointsEarned ?? 0;
  }
}
