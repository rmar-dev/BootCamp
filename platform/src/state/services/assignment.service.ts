import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CohortRepository } from '../repositories/cohort.repository';
import { LessonAssignmentRepository } from '../repositories/lesson-assignment.repository';

export type ResolveInput = {
  studentId: string;
  lessonId: string;
  lessonVersion: number;
  poolExerciseIds: string[];
};

export type ResolveResult =
  | {
      status: 'active';
      assignmentId: string;
      selectedExerciseIds: string[];
    }
  | {
      status: 'pool_complete';
      allExerciseIds: string[];
    };

export class PoolCompleteException extends ConflictException {
  constructor() {
    // Intentional object body: gives clients a machine-readable `error: 'pool_complete'` slug in the 409 response.
    super({ error: 'pool_complete', message: 'pool_complete: No unseen exercises remain to rotate to.' });
  }
}

const DEFAULT_TARGET = 4;

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohorts: CohortRepository,
    private readonly assignments: LessonAssignmentRepository,
  ) {}

  async resolve(input: ResolveInput): Promise<ResolveResult> {
    const existing = await this.assignments.findActive(input.studentId, input.lessonId);
    if (existing) {
      return {
        status: 'active',
        assignmentId: existing.id,
        selectedExerciseIds: existing.selectedExerciseIds,
      };
    }
    return this.createNew(input);
  }

  async revisit(input: ResolveInput): Promise<ResolveResult> {
    const active = await this.assignments.findActive(input.studentId, input.lessonId);
    if (active) {
      // Known gap: this close + new-create pair isn't wrapped in a transaction. If createNew throws,
      // the old assignment is left closed with no replacement. Next resolve() bootstraps a fresh one,
      // so the student isn't stuck — but the closed ghost record can appear in instructor analytics.
      // Revisit if transactionality becomes important (would require threading tx through repositories).
      await this.assignments.markCompleted(active.id);
    }
    const result = await this.createNew(input);
    if (result.status === 'pool_complete') {
      throw new PoolCompleteException();
    }
    return result;
  }

  async poolStatus(
    studentId: string,
    lessonId: string,
    poolExerciseIds: string[],
  ): Promise<{ poolSize: number; seenCount: number; currentAssignmentIds: string[]; poolComplete: boolean }> {
    const seen = await this.seenExerciseIds(studentId, poolExerciseIds);
    const active = await this.assignments.findActive(studentId, lessonId);
    return {
      poolSize: poolExerciseIds.length,
      seenCount: seen.size,
      currentAssignmentIds: active?.selectedExerciseIds ?? [],
      poolComplete: poolExerciseIds.length > 0 && seen.size === poolExerciseIds.length,
    };
  }

  private async createNew(input: ResolveInput): Promise<ResolveResult> {
    const cohort = await this.cohorts.findByStudentId(input.studentId);
    const requestedTarget = cohort?.exercisesPerLessonTarget ?? DEFAULT_TARGET;
    // Clamp target to pool size so single-exercise capstone lessons don't falsely fail.
    const effectiveTarget = Math.min(requestedTarget, input.poolExerciseIds.length);
    const seen = await this.seenExerciseIds(input.studentId, input.poolExerciseIds);
    const unseen = input.poolExerciseIds.filter((id) => !seen.has(id));

    if (unseen.length < effectiveTarget) {
      return { status: 'pool_complete', allExerciseIds: input.poolExerciseIds };
    }
    const selected = unseen.slice(0, effectiveTarget);
    const created = await this.assignments.create({
      studentId: input.studentId,
      lessonId: input.lessonId,
      lessonVersion: input.lessonVersion,
      selectedExerciseIds: selected,
    });
    return { status: 'active', assignmentId: created.id, selectedExerciseIds: selected };
  }

  private async seenExerciseIds(studentId: string, poolIds: string[]): Promise<Set<string>> {
    if (poolIds.length === 0) return new Set();
    const attempts = await this.prisma.attempt.findMany({
      where: { studentId, exerciseId: { in: poolIds } },
      select: { exerciseId: true },
    });
    return new Set(attempts.map((a) => a.exerciseId));
  }
}
