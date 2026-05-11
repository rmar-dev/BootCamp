import { Injectable } from '@nestjs/common';
import { Exercise, ExerciseType, ExerciseVisibility } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExercisePayload } from '../types/exercise-payload.types';
import { parseExercisePayload } from '../validators/exercise-payload.validator';

export type CreateExerciseInput = {
  id: string;
  lessonId: string;
  promptMarkdown: string;
  type: ExerciseType;
  payload: ExercisePayload;
  pointsMax: number;
  hints: string[];
  concepts: string[];
  // Authorship + scope (sub-project G). Curriculum-authored exercises leave
  // both unset (defaults: authorId=null, visibility='public', scopeId=null).
  // Instructor-authored exercises set authorId and may scope by visibility.
  authorId?: string | null;
  visibility?: ExerciseVisibility;
  scopeId?: string | null;
};

export type NextExerciseVersionInput = Omit<CreateExerciseInput, 'id'>;

@Injectable()
export class ExerciseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateExerciseInput): Promise<Exercise> {
    parseExercisePayload(input.type, input.payload);
    return this.prisma.exercise.create({
      data: {
        id: input.id,
        version: 1,
        lessonId: input.lessonId,
        promptMarkdown: input.promptMarkdown,
        type: input.type,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        pointsMax: input.pointsMax,
        hints: input.hints,
        concepts: input.concepts,
        publishedAt: null,
        authorId: input.authorId ?? null,
        visibility: input.visibility ?? ExerciseVisibility.public,
        scopeId: input.scopeId ?? null,
      },
    });
  }

  async createNextVersion(
    id: string,
    input: NextExerciseVersionInput,
  ): Promise<Exercise> {
    parseExercisePayload(input.type, input.payload);
    const latest = await this.prisma.exercise.findFirst({
      where: { id },
      orderBy: { version: 'desc' },
    });
    if (!latest) {
      throw new Error(`No existing exercise with id ${id}`);
    }
    return this.prisma.exercise.create({
      data: {
        id,
        version: latest.version + 1,
        lessonId: input.lessonId,
        promptMarkdown: input.promptMarkdown,
        type: input.type,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        pointsMax: input.pointsMax,
        hints: input.hints,
        concepts: input.concepts,
        publishedAt: null,
        // New versions inherit authorship + visibility from the prior row by
        // default (a custom exercise stays the same author's, in the same
        // scope, across versions). Caller can override by passing the field.
        authorId: input.authorId ?? latest.authorId,
        visibility: input.visibility ?? latest.visibility,
        scopeId: input.scopeId ?? latest.scopeId,
      },
    });
  }

  async publish(id: string, version: number): Promise<Exercise> {
    return this.prisma.exercise.update({
      where: { id_version: { id, version } },
      data: { publishedAt: new Date() },
    });
  }

  async findByVersion(id: string, version: number): Promise<Exercise | null> {
    return this.prisma.exercise.findUnique({
      where: { id_version: { id, version } },
    });
  }

  async findLatestPublished(id: string): Promise<Exercise | null> {
    return this.prisma.exercise.findFirst({
      where: { id, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Returns the published exercises authored by the given instructor.
   * Each row is the latest version per exercise id.
   *
   * Backed by the `(authorId)` index. Used by the
   * `GET /api/instructor/exercises/mine` endpoint to populate the instructor's
   * authored-exercises list with usage and visibility metadata.
   */
  async findByAuthor(authorUserId: string): Promise<Exercise[]> {
    // Fetch all rows authored by this user, then reduce to the latest version
    // per id. Cheap: an instructor authors tens to hundreds, not millions.
    const rows = await this.prisma.exercise.findMany({
      where: { authorId: authorUserId },
      orderBy: [{ id: 'asc' }, { version: 'desc' }],
    });
    const seen = new Set<string>();
    const latest: Exercise[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      latest.push(r);
    }
    return latest;
  }

  /**
   * Returns the published exercises a given student is allowed to see for a
   * given lesson, expanding the four visibility scopes:
   *   - public exercises (the curriculum baseline)
   *   - track-scoped, where scopeId === the lesson's trackId
   *   - cohort-scoped, where scopeId === the student's cohortId (or none if
   *     the student has no cohort)
   *   - private_to_student, where scopeId === the student's id
   *
   * Returns LATEST published version per exercise id. Backed by the
   * `(visibility, scopeId)` index. Used by the lesson-assembly path when
   * deciding which exercises to surface for instructor-authored content.
   */
  async findVisibleForStudent(input: {
    lessonId: string;
    studentId: string;
    cohortId: string | null;
    trackId: string;
  }): Promise<Exercise[]> {
    const visibilityFilters: Prisma.ExerciseWhereInput[] = [
      { visibility: ExerciseVisibility.public },
      { visibility: ExerciseVisibility.track, scopeId: input.trackId },
      { visibility: ExerciseVisibility.private_to_student, scopeId: input.studentId },
    ];
    if (input.cohortId) {
      visibilityFilters.push({
        visibility: ExerciseVisibility.cohort,
        scopeId: input.cohortId,
      });
    }
    const rows = await this.prisma.exercise.findMany({
      where: {
        lessonId: input.lessonId,
        publishedAt: { not: null },
        OR: visibilityFilters,
      },
      orderBy: [{ id: 'asc' }, { version: 'desc' }],
    });
    const seen = new Set<string>();
    const latest: Exercise[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      latest.push(r);
    }
    return latest;
  }
}
