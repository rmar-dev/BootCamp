import { Injectable } from '@nestjs/common';
import { Attempt, ExerciseResult, Prisma } from '@prisma/client';
import { newId } from '../../shared/ids';
import { ExerciseRepository } from '../../content/repositories/exercise.repository';
import { parseSubmissionPayload } from '../../content/validators/submission-payload.validator';
import { SubmissionPayload } from '../../content/types/submission-payload.types';
import { AttemptRepository } from '../repositories/attempt.repository';
import { ExerciseResultRepository } from '../repositories/exercise-result.repository';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../../prisma/prisma.service';

export type RecordAttemptInput = {
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  submissionPayload: SubmissionPayload;
  passed: boolean;
  hintsUsedCount: number;
};

export type RecordAttemptResult = {
  attempt: Attempt;
  exerciseResult: ExerciseResult;
};

@Injectable()
export class AttemptService {
  constructor(
    private readonly attempts: AttemptRepository,
    private readonly results: ExerciseResultRepository,
    private readonly exercises: ExerciseRepository,
    private readonly scoring: ScoringService,
    private readonly prisma: PrismaService,
  ) {}

  async recordAttempt(input: RecordAttemptInput): Promise<RecordAttemptResult> {
    const exercise = await this.exercises.findByVersion(
      input.exerciseId,
      input.exerciseVersion,
    );
    if (!exercise) {
      throw new Error(
        `Exercise ${input.exerciseId} v${input.exerciseVersion} not found`,
      );
    }

    parseSubmissionPayload(exercise.type, input.submissionPayload);

    return this.prisma.$transaction(
      async (tx) => {
        const failedAttemptsBefore = await tx.attempt.count({
          where: {
            studentId: input.studentId,
            exerciseId: input.exerciseId,
            passed: false,
          },
        });

        const pointsAwarded = this.scoring.computePoints({
          passed: input.passed,
          pointsMax: exercise.pointsMax,
          hintsUsedCount: input.hintsUsedCount,
          failedAttemptsBefore,
        });

        const attempt = await tx.attempt.create({
          data: {
            id: newId(),
            studentId: input.studentId,
            exerciseId: input.exerciseId,
            exerciseVersion: input.exerciseVersion,
            submissionPayload:
              input.submissionPayload as unknown as Prisma.InputJsonValue,
            passed: input.passed,
            hintsUsedCount: input.hintsUsedCount,
            failedAttemptsBefore,
            pointsAwarded,
          },
        });

        const existingResult = await tx.exerciseResult.findUnique({
          where: {
            studentId_exerciseId: {
              studentId: input.studentId,
              exerciseId: input.exerciseId,
            },
          },
        });
        const totalAttempts = (existingResult?.attemptsCount ?? 0) + 1;

        const newPassed = (existingResult?.passed ?? false) || input.passed;
        const previousPoints = existingResult?.pointsEarned ?? 0;
        const newPoints = Math.max(previousPoints, pointsAwarded);
        const bestAttemptId =
          newPoints > previousPoints
            ? attempt.id
            : (existingResult?.bestAttemptId ?? attempt.id);
        const firstPassedAt =
          existingResult?.firstPassedAt ??
          (input.passed ? attempt.submittedAt : null);

        const resultId = existingResult?.id ?? newId();
        const exerciseResult = await tx.exerciseResult.upsert({
          where: {
            studentId_exerciseId: {
              studentId: input.studentId,
              exerciseId: input.exerciseId,
            },
          },
          create: {
            id: resultId,
            studentId: input.studentId,
            exerciseId: input.exerciseId,
            bestAttemptId,
            passed: newPassed,
            pointsEarned: newPoints,
            attemptsCount: totalAttempts,
            firstPassedAt,
          },
          update: {
            bestAttemptId,
            passed: newPassed,
            pointsEarned: newPoints,
            attemptsCount: totalAttempts,
            firstPassedAt,
          },
        });

        return { attempt, exerciseResult };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
