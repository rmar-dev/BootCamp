import { Injectable } from '@nestjs/common';
import { ExamDifficultyOverride } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ExamOverrideUpsertInput = {
  studentId: string;
  exerciseId: string;
  exerciseVersion: number;
  extendTimeMs?: number | null;
  optional?: boolean;
  swapToExerciseId?: string | null;
  swapToExerciseVersion?: number | null;
  updatedBy: string;
};

@Injectable()
export class ExamDifficultyOverrideRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All overrides currently set for a student. Used by the lesson assembler
   * to apply per-exam tweaks after the difficulty-biased exercise picker has
   * chosen the pool. Cheap query — covered by the (studentId) index.
   */
  async findByStudent(studentId: string): Promise<ExamDifficultyOverride[]> {
    return this.prisma.examDifficultyOverride.findMany({
      where: { studentId },
    });
  }

  /**
   * Single-exercise lookup. Covered by the unique index on
   * (studentId, exerciseId).
   */
  async findOne(studentId: string, exerciseId: string): Promise<ExamDifficultyOverride | null> {
    return this.prisma.examDifficultyOverride.findUnique({
      where: {
        studentId_exerciseId: { studentId, exerciseId },
      },
    });
  }

  /**
   * Upsert keyed by (studentId, exerciseId). The instructor passes only the
   * fields they want to change; absent fields update to NULL on overwrite so
   * an instructor can intentionally clear an override field by re-upserting
   * without it.
   */
  async upsert(input: ExamOverrideUpsertInput): Promise<ExamDifficultyOverride> {
    const data = {
      exerciseVersion: input.exerciseVersion,
      extendTimeMs: input.extendTimeMs ?? null,
      optional: input.optional ?? false,
      swapToExerciseId: input.swapToExerciseId ?? null,
      swapToExerciseVersion: input.swapToExerciseVersion ?? null,
      updatedBy: input.updatedBy,
    };
    return this.prisma.examDifficultyOverride.upsert({
      where: {
        studentId_exerciseId: { studentId: input.studentId, exerciseId: input.exerciseId },
      },
      update: data,
      create: {
        studentId: input.studentId,
        exerciseId: input.exerciseId,
        ...data,
      },
    });
  }

  async remove(studentId: string, exerciseId: string): Promise<void> {
    await this.prisma.examDifficultyOverride.delete({
      where: {
        studentId_exerciseId: { studentId, exerciseId },
      },
    });
  }
}
