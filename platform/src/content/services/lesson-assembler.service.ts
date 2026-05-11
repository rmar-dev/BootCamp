import { Injectable, Logger } from '@nestjs/common';
import { ExerciseVisibility } from '@prisma/client';
import { LessonRepository } from '../repositories/lesson.repository';
import { ExerciseRepository } from '../repositories/exercise.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamDifficultyOverrideRepository } from '../../state/repositories/exam-difficulty-override.repository';
import { ExercisePayload } from '../types/exercise-payload.types';
import { ExerciseTypeValue } from '../types/exercise-type.enum';
import { ExerciseAttemptStatus } from '../types/attempt-status';
import { computeStatus } from './attempt-status.util';

/**
 * Pure visibility check — given an exercise's authorship/visibility/scope,
 * decide whether the calling student is allowed to see it. Mirrors
 * ExerciseRepository.findVisibleForStudent's filter exactly so the two paths
 * stay in sync.
 *
 * Curriculum-authored content is always public + scopeId=null, so this is a
 * no-op for the existing curriculum baseline. The four-scope check matters
 * only when an instructor authors a scoped exercise via the builder.
 */
function isExerciseVisibleToStudent(
  exercise: { visibility: ExerciseVisibility; scopeId: string | null },
  ctx: { studentId?: string; cohortId?: string | null; trackId?: string | null },
): boolean {
  if (exercise.visibility === ExerciseVisibility.public) return true;
  if (!ctx.studentId) {
    // No student context (preview / version mode) — instructor-scoped
    // content stays hidden in preview to avoid leaking via the
    // unauthenticated-style path.
    return false;
  }
  if (exercise.visibility === ExerciseVisibility.private_to_student) {
    return exercise.scopeId === ctx.studentId;
  }
  if (exercise.visibility === ExerciseVisibility.cohort) {
    return !!ctx.cohortId && exercise.scopeId === ctx.cohortId;
  }
  if (exercise.visibility === ExerciseVisibility.track) {
    return !!ctx.trackId && exercise.scopeId === ctx.trackId;
  }
  return false;
}

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
  attemptStatus: ExerciseAttemptStatus;
  // Author-supplied progressive hints. Surfaced by renderers behind a "Hint"
  // affordance (e.g. CodeExercise reveals one at a time on click).
  hints: string[];
  // The student's most recent submissionPayload for this exercise, or null
  // if they haven't attempted it yet. Used by renderers to pre-populate the
  // editor/inputs and lock submit when attemptStatus !== 'unattempted'.
  // Always null when assembled without a studentId (preview / version mode).
  lastResponse: unknown;
  // Per-(student, exercise) instructor override fields.
  // Both are absent (not just falsy) when no override row exists, so the
  // renderer can distinguish "not configured" from "configured to default".
  // extendTimeMs widens any timer the renderer applies for this exercise.
  // optional=true lets the student skip without penalty.
  // Always omitted in preview / version mode (no studentId).
  extendTimeMs?: number;
  optional?: boolean;
};

// Authored video block. `url` is a canonical URL — the web renderer detects
// the source (YouTube, Vimeo, Loom, direct .mp4, generic iframe) and picks
// the right embed strategy. The DTO is symmetric with web's `VideoBlockData`.
export type VideoBlockDTO = {
  url: string;
  title?: string;
  description?: string;
  durationLabel?: string;
  posterUrl?: string;
};

export type LessonBlockDTO =
  | { kind: 'explanation'; id: string; markdown: string }
  | { kind: 'exercise'; id: string; exercise: ExerciseDTO }
  | { kind: 'video'; id: string; video: VideoBlockDTO };

export type LessonAssignmentState =
  | { status: 'active'; id: string; selectedExerciseIds: string[] }
  | { status: 'pool_complete'; allExerciseIds: string[] };

export type LessonResponseDTO = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: LessonBlockDTO[];
  assignment: LessonAssignmentState | null;  // null in preview mode
};

@Injectable()
export class LessonAssemblerService {
  private readonly logger = new Logger(LessonAssemblerService.name);

  constructor(
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
    private readonly prisma: PrismaService,
    private readonly examOverrides: ExamDifficultyOverrideRepository,
  ) {}

  async assembleLatest(id: string): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) return null;
    return this.toResponseWithAssignment(lesson, null);
  }

  async assembleByVersion(
    id: string,
    version: number,
  ): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findPublishedByVersionWithBlocks(id, version);
    if (!lesson) return null;
    return this.toResponseWithAssignment(lesson, null);
  }

  async assembleLatestForStudent(
    id: string,
    assignmentState: LessonAssignmentState,
    studentId: string,
    cohortId?: string | null,
  ): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) return null;
    return this.toResponseWithAssignment(lesson, assignmentState, studentId, cohortId);
  }

  async assembleLatestPreview(id: string): Promise<LessonResponseDTO | null> {
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) return null;
    return this.toResponseWithAssignment(lesson, null);
  }

  private async toResponseWithAssignment(
    lesson: NonNullable<Awaited<ReturnType<LessonRepository['findLatestPublishedWithBlocks']>>>,
    assignment: LessonAssignmentState | null,
    studentId?: string,
    cohortId?: string | null,
  ): Promise<LessonResponseDTO> {
    const allowedExerciseIds =
      assignment?.status === 'active'
        ? new Set(assignment.selectedExerciseIds)
        : null;

    const blocks: LessonBlockDTO[] = [];
    const exerciseRefs: { id: string; version: number }[] = [];

    for (const block of lesson.blocks) {
      if (block.kind === 'explanation') {
        blocks.push({ kind: 'explanation', id: block.id, markdown: block.explanationMarkdown ?? '' });
        continue;
      }
      if (block.kind === 'video') {
        if (!block.videoUrl) {
          this.logger.warn(`Video block ${block.id} in lesson ${lesson.id} v${lesson.version} has no videoUrl — skipping`);
          continue;
        }
        blocks.push({
          kind: 'video',
          id: block.id,
          video: {
            url: block.videoUrl,
            title: block.videoTitle ?? undefined,
            description: block.videoDescription ?? undefined,
            durationLabel: block.videoDurationLabel ?? undefined,
            posterUrl: block.videoPosterUrl ?? undefined,
          },
        });
        continue;
      }
      if (!block.exerciseId || block.exerciseVersion == null) {
        this.logger.warn(`Exercise block ${block.id} in lesson ${lesson.id} v${lesson.version} has missing exerciseId or exerciseVersion — skipping`);
        continue;
      }
      if (allowedExerciseIds && !allowedExerciseIds.has(block.exerciseId)) continue;
      const ex = await this.exercises.findByVersion(block.exerciseId, block.exerciseVersion);
      if (!ex || ex.publishedAt === null) {
        this.logger.warn(`Exercise block ${block.id} in lesson ${lesson.id} v${lesson.version} references unpublished or missing exercise ${block.exerciseId} v${block.exerciseVersion} — skipping`);
        continue;
      }
      // Visibility filter (sub-project G): drop exercises the calling
      // student isn't allowed to see based on Exercise.visibility/scopeId.
      // Public exercises (curriculum baseline) always pass; the four-scope
      // check only matters for instructor-authored content.
      if (
        !isExerciseVisibleToStudent(
          { visibility: ex.visibility, scopeId: ex.scopeId },
          { studentId, cohortId, trackId: lesson.trackId },
        )
      ) {
        this.logger.debug(
          `Exercise block ${block.id} hidden by visibility (visibility=${ex.visibility}, scopeId=${ex.scopeId}, studentId=${studentId}, cohortId=${cohortId}, trackId=${lesson.trackId})`,
        );
        continue;
      }
      exerciseRefs.push({ id: ex.id, version: ex.version });
      blocks.push({
        kind: 'exercise',
        id: block.id,
        exercise: {
          id: ex.id,
          version: ex.version,
          type: ex.type as ExerciseTypeValue,
          promptMarkdown: ex.promptMarkdown,
          pointsMax: ex.pointsMax,
          payload: ex.payload as ExercisePayload,
          attemptStatus: 'unattempted',
          hints: ex.hints ?? [],
          lastResponse: null,
        },
      });
    }

    if (studentId && exerciseRefs.length > 0) {
      const attempts = await this.prisma.attempt.findMany({
        where: {
          studentId,
          OR: exerciseRefs.map((r) => ({ exerciseId: r.id, exerciseVersion: r.version })),
        },
        orderBy: { submittedAt: 'asc' },
        select: {
          exerciseId: true,
          exerciseVersion: true,
          passed: true,
          submissionPayload: true,
        },
      });
      const byKey = new Map<string, { passed: boolean }[]>();
      // Track the latest submissionPayload per exercise. Attempts are ordered
      // submittedAt asc, so the last write to lastByKey wins → the most recent.
      const lastByKey = new Map<string, unknown>();
      for (const a of attempts) {
        const key = `${a.exerciseId}@${a.exerciseVersion}`;
        const list = byKey.get(key) ?? [];
        list.push({ passed: a.passed });
        byKey.set(key, list);
        lastByKey.set(key, a.submissionPayload);
      }
      for (const block of blocks) {
        if (block.kind !== 'exercise') continue;
        const key = `${block.exercise.id}@${block.exercise.version}`;
        block.exercise.attemptStatus = computeStatus(byKey.get(key) ?? []);
        block.exercise.lastResponse = lastByKey.get(key) ?? null;
      }

      // Per-exam difficulty overrides — only the render-time fields
      // (extendTimeMs, optional). Swap and difficulty bias apply at
      // assignment-creation time, not here.
      const overrides = await this.examOverrides.findByStudent(studentId);
      if (overrides.length > 0) {
        const overrideByExerciseId = new Map(overrides.map((o) => [o.exerciseId, o] as const));
        for (const block of blocks) {
          if (block.kind !== 'exercise') continue;
          const o = overrideByExerciseId.get(block.exercise.id);
          if (!o) continue;
          if (o.extendTimeMs != null) block.exercise.extendTimeMs = o.extendTimeMs;
          if (o.optional) block.exercise.optional = true;
        }
      }
    }

    return {
      id: lesson.id,
      version: lesson.version,
      title: lesson.title,
      trackId: lesson.trackId,
      blocks,
      assignment,
    };
  }
}
