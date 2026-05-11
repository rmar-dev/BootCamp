import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BlockKind, ExerciseType, ExerciseVisibility, LessonLevel } from '@prisma/client';
import { LessonRepository, type BlockInput } from '../content/repositories/lesson.repository';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { TrackRepository } from '../content/repositories/track.repository';
import { PublishService } from '../content/services/publish.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseExercisePayload } from '../content/validators/exercise-payload.validator';
import type { ExercisePayload } from '../content/types/exercise-payload.types';

// ── Request shape sent by the builder ────────────────────────────────────────

export type SaveBlockInput =
  | { kind: 'explanation'; markdown: string }
  | {
      kind: 'video';
      videoUrl: string;
      videoTitle?: string;
      videoDescription?: string;
      videoDurationLabel?: string;
      videoPosterUrl?: string;
    }
  | {
      kind: 'exercise';
      /** Set when this exercise originated from an existing fork. Triggers
       *  createNextVersion; absence triggers createDraft (new entity). */
      existingExerciseId?: string;
      promptMarkdown: string;
      type: ExerciseType;
      payload: ExercisePayload;
      pointsMax: number;
      hints: string[];
      concepts: string[];
      // Visibility scope for instructor-authored exercises (sub-project G).
      // Optional on the wire — when omitted, the service defaults visibility
      // based on the lesson visibility provided at the request level.
      visibility?: ExerciseVisibility;
      scopeId?: string | null;
    };

export interface SaveLessonInput {
  trackId: string;
  title: string;
  level: LessonLevel;
  summary: string;
  blocks: SaveBlockInput[];
  /** Default true — instructors clicking 'Publish' in the UI expect their
   * cohort to see the change immediately. The builder can pass false for
   * draft-save without publishing. */
  publish?: boolean;
  // Default visibility applied to every exercise block that doesn't carry its
  // own (sub-project G). Omitted = 'public' (curriculum-style). When set to
  // anything other than 'public', `scopeId` MUST be present and matches the
  // lesson-wide scope.
  visibility?: ExerciseVisibility;
  scopeId?: string | null;
  // The User.id of the calling instructor — stamped onto authored exercises
  // as `authorId`. Set by the controller from the JWT.
  authorUserId?: string | null;
}

// ── Response shape returned to the builder ───────────────────────────────────

export interface SaveLessonResult {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackVersion: number;
  /** New (id, version) for each exercise block, in the order they were sent.
   * Lets the frontend swap its local mock ids for the canonical ones so
   * subsequent saves can carry `existingExerciseId` correctly. */
  exercises: Array<{ blockIndex: number; id: string; version: number }>;
}

@Injectable()
export class InstructorContentService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
    private readonly tracks: TrackRepository,
    private readonly publisher: PublishService,
    private readonly prisma: PrismaService,
  ) {}

  /** Create a brand-new lesson and slot it onto a track. */
  async createLesson(input: SaveLessonInput): Promise<SaveLessonResult> {
    await this.assertTrackExists(input.trackId);
    const newLessonId = randomUUID();
    return this.persistLesson(newLessonId, /* lessonExists */ false, input);
  }

  /** Create the next version of an existing lesson. Used when an instructor
   * "Updates original" on a forked draft. */
  async updateLesson(
    existingLessonId: string,
    input: SaveLessonInput,
  ): Promise<SaveLessonResult> {
    const latestLesson = await this.prisma.lesson.findFirst({
      where: { id: existingLessonId },
      orderBy: { version: 'desc' },
    });
    if (!latestLesson) {
      throw new NotFoundException(`Lesson ${existingLessonId} not found`);
    }
    // Force the trackId from the existing lesson so callers can't accidentally
    // re-home a lesson into a different track via the update path.
    const targetInput: SaveLessonInput = { ...input, trackId: latestLesson.trackId };
    return this.persistLesson(existingLessonId, /* lessonExists */ true, targetInput);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async assertTrackExists(trackId: string): Promise<void> {
    const track = await this.prisma.track.findFirst({ where: { id: trackId } });
    if (!track) throw new BadRequestException(`Track ${trackId} not found`);
  }

  private async persistLesson(
    lessonId: string,
    lessonExists: boolean,
    input: SaveLessonInput,
  ): Promise<SaveLessonResult> {
    // Fail fast on payload validation — surface every issue before we touch
    // the DB so a half-written lesson can't end up orphaned.
    const exerciseBlocks = input.blocks
      .map((b, idx) => ({ block: b, idx }))
      .filter((p): p is { block: Extract<SaveBlockInput, { kind: 'exercise' }>; idx: number } => p.block.kind === 'exercise');
    for (const { block, idx } of exerciseBlocks) {
      try {
        parseExercisePayload(block.type, block.payload);
      } catch (err) {
        throw new BadRequestException(
          `Block ${idx + 1} (exercise): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 1. Create exercise versions (or new exercises) for every exercise block.
    // Visibility/scope: per-block override wins; otherwise inherit the
    // lesson-wide default (input.visibility / input.scopeId), which itself
    // falls through to the schema default ('public', no scope) when absent.
    const lessonDefaultVisibility = input.visibility ?? ExerciseVisibility.public;
    const lessonDefaultScopeId = input.scopeId ?? null;
    const authorUserId = input.authorUserId ?? null;

    const exerciseRefs: Array<{ blockIndex: number; id: string; version: number }> = [];
    for (const { block, idx } of exerciseBlocks) {
      const blockVisibility = block.visibility ?? lessonDefaultVisibility;
      const blockScopeId = block.scopeId ?? lessonDefaultScopeId;
      // Coherence: any non-public visibility requires a scopeId. Surface a
      // 400 here rather than let a malformed row land in the DB.
      if (blockVisibility !== ExerciseVisibility.public && !blockScopeId) {
        throw new BadRequestException(
          `Block ${idx + 1} (exercise): visibility '${blockVisibility}' requires scopeId`,
        );
      }
      let saved: { id: string; version: number };
      if (block.existingExerciseId) {
        const next = await this.exercises.createNextVersion(block.existingExerciseId, {
          lessonId,
          promptMarkdown: block.promptMarkdown,
          type: block.type,
          payload: block.payload,
          pointsMax: block.pointsMax,
          hints: block.hints,
          concepts: block.concepts,
          // Inherit by default in createNextVersion — only override if the
          // builder explicitly sent a different scope on this block.
          ...(block.visibility ? { visibility: blockVisibility } : {}),
          ...(block.scopeId !== undefined ? { scopeId: blockScopeId } : {}),
          ...(authorUserId ? { authorId: authorUserId } : {}),
        });
        saved = { id: next.id, version: next.version };
      } else {
        const created = await this.exercises.createDraft({
          id: randomUUID(),
          lessonId,
          promptMarkdown: block.promptMarkdown,
          type: block.type,
          payload: block.payload,
          pointsMax: block.pointsMax,
          hints: block.hints,
          concepts: block.concepts,
          authorId: authorUserId,
          visibility: blockVisibility,
          scopeId: blockScopeId,
        });
        saved = { id: created.id, version: created.version };
      }
      exerciseRefs.push({ blockIndex: idx, id: saved.id, version: saved.version });
    }

    // 2. Build BlockInput[] for the lesson, weaving the new exercise refs in.
    const refsByIndex = new Map(exerciseRefs.map((r) => [r.blockIndex, r] as const));
    const blockInputs: BlockInput[] = input.blocks.map((b, idx) => {
      const blockId = randomUUID();
      if (b.kind === 'explanation') {
        return {
          id: blockId,
          position: idx,
          kind: BlockKind.explanation,
          explanationMarkdown: b.markdown,
        };
      }
      if (b.kind === 'video') {
        return {
          id: blockId,
          position: idx,
          kind: BlockKind.video,
          videoUrl: b.videoUrl,
          videoTitle: b.videoTitle,
          videoDescription: b.videoDescription,
          videoDurationLabel: b.videoDurationLabel,
          videoPosterUrl: b.videoPosterUrl,
        };
      }
      const ref = refsByIndex.get(idx);
      if (!ref) {
        // Defensive — exerciseRefs should contain every exercise block we
        // collected at the top of this method. If this throws, something
        // upstream is misaligning indexes.
        throw new Error(`Internal: missing exercise ref for block index ${idx}`);
      }
      return {
        id: blockId,
        position: idx,
        kind: BlockKind.exercise,
        exerciseId: ref.id,
        exerciseVersion: ref.version,
      };
    });

    // 3. Create lesson (draft or next version) with these blocks.
    const lesson = lessonExists
      ? await this.lessons.createNextVersion(lessonId, {
          trackId: input.trackId,
          // position is recomputed when we cascade to the track below.
          // Carry forward the lesson's existing position if there is one.
          position: 0,
          title: input.title,
          level: input.level,
          summary: input.summary,
          blocks: blockInputs,
        })
      : await this.lessons.createDraft({
          id: lessonId,
          trackId: input.trackId,
          position: 0,
          title: input.title,
          level: input.level,
          summary: input.summary,
          blocks: blockInputs,
        });

    // 4. Cascade to track: load the latest, splice in the new (lessonId,
    // lessonVersion), and create the next track version.
    const latestTrack = await this.prisma.track.findFirst({
      where: { id: input.trackId },
      orderBy: { version: 'desc' },
    });
    if (!latestTrack) {
      throw new BadRequestException(`Track ${input.trackId} not found`);
    }
    const nextLessonIds = [...latestTrack.lessonIds];
    const nextLessonVersions = [...latestTrack.lessonVersions];
    const existingPos = nextLessonIds.indexOf(lessonId);
    if (existingPos >= 0) {
      // Update path: bump the version in place.
      nextLessonVersions[existingPos] = lesson.version;
    } else {
      // New lesson: append.
      nextLessonIds.push(lessonId);
      nextLessonVersions.push(lesson.version);
    }
    const newTrack = await this.tracks.createNextVersion(input.trackId, {
      title: latestTrack.title,
      language: latestTrack.language,
      kind: latestTrack.kind,
      description: latestTrack.description,
      lessons: nextLessonIds.map((id, i) => ({ id, version: nextLessonVersions[i] })),
    });

    // 5. Publish bottom-up if asked. PublishService walks the track and
    // stamps publishedAt on any unpublished exercise → lesson → track in
    // its lessonIds + lessonVersions arrays — exactly the new chain we
    // just created.
    if (input.publish !== false) {
      await this.publisher.publishTrack(newTrack.id, newTrack.version);
    }

    return {
      lessonId,
      lessonVersion: lesson.version,
      trackId: newTrack.id,
      trackVersion: newTrack.version,
      exercises: exerciseRefs,
    };
  }
}
