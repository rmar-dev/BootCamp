import { Injectable } from '@nestjs/common';
import { DifficultyBaseline, StudentDifficulty } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentDifficultyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the student's baseline row, or `null` when no row exists.
   * Callers that want a defaulted value should use {@link getOrDefault}.
   */
  async findByStudent(studentId: string): Promise<StudentDifficulty | null> {
    return this.prisma.studentDifficulty.findUnique({ where: { studentId } });
  }

  /**
   * Returns the student's baseline; falls back to 'standard' when the
   * student has no row yet. The fallback is value-only — no row is created.
   */
  async getOrDefault(studentId: string): Promise<DifficultyBaseline> {
    const row = await this.findByStudent(studentId);
    return row?.baseline ?? DifficultyBaseline.standard;
  }

  /**
   * Upsert: idempotent set-or-update of the dial. The instructor's userId is
   * stamped onto every write (`updatedBy`) for future audit-log work.
   */
  async upsert(
    studentId: string,
    baseline: DifficultyBaseline,
    instructorUserId: string,
  ): Promise<StudentDifficulty> {
    return this.prisma.studentDifficulty.upsert({
      where: { studentId },
      update: { baseline, updatedBy: instructorUserId },
      create: { studentId, baseline, updatedBy: instructorUserId },
    });
  }
}
