import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { parseTrackFile, parseLessonFile } from './parser.js';
import { stableId, contentHash } from './hasher.js';
import { buildExercisePayload, validateLesson } from './validator.js';
import { publishTrack } from './publisher.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CompileResult = {
  tracksCompiled: number;
  lessonsCompiled: number;
  exercisesCompiled: number;
  skipped: number;
  errors: string[];
};

type CompileOptions = {
  publish?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function discoverTrackSlugs(curriculumDir: string): string[] {
  const entries = readdirSync(curriculumDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(join(curriculumDir, e.name, 'track.md')))
    .map((e) => e.name);
}

// ── Core pipeline ──────────────────────────────────────────────────────────────

async function compileTrackInternal(
  prisma: PrismaClient,
  curriculumDir: string,
  trackSlug: string,
  options: CompileOptions,
): Promise<CompileResult> {
  const result: CompileResult = {
    tracksCompiled: 0,
    lessonsCompiled: 0,
    exercisesCompiled: 0,
    skipped: 0,
    errors: [],
  };

  // ── 1. Parse track.md ──────────────────────────────────────────────────────
  const trackFilePath = join(curriculumDir, trackSlug, 'track.md');
  if (!existsSync(trackFilePath)) {
    result.errors.push(`Track file not found: ${trackFilePath}`);
    return result;
  }

  const trackContent = readFileSync(trackFilePath, 'utf-8');
  let trackMeta;
  try {
    trackMeta = parseTrackFile(trackContent);
  } catch (err) {
    result.errors.push(`Failed to parse track.md for ${trackSlug}: ${String(err)}`);
    return result;
  }

  // ── 2. Parse all lessons ───────────────────────────────────────────────────
  type ParsedLessonEntry = {
    slug: string;
    position: number;
    lessonId: string;
    content: ReturnType<typeof parseLessonFile>;
  };

  const parsedLessons: ParsedLessonEntry[] = [];

  for (let i = 0; i < trackMeta.lessons.length; i++) {
    const lessonSlug = trackMeta.lessons[i];
    const lessonPath = join(curriculumDir, trackSlug, `${lessonSlug}.md`);
    if (!existsSync(lessonPath)) {
      result.errors.push(`Lesson file not found: ${lessonPath}`);
      continue;
    }

    const lessonContent = readFileSync(lessonPath, 'utf-8');
    try {
      const parsed = parseLessonFile(lessonContent);
      validateLesson(parsed);
      const lessonId = stableId(`lesson:${trackSlug}/${lessonSlug}`);
      parsedLessons.push({ slug: lessonSlug, position: i, lessonId, content: parsed });
    } catch (err) {
      result.errors.push(`Failed to parse lesson ${lessonSlug}: ${String(err)}`);
    }
  }

  if (result.errors.length > 0) return result;

  // ── 3. Validate all exercises ──────────────────────────────────────────────
  type ExerciseEntry = {
    exerciseId: string;
    lessonId: string;
    lessonSlug: string;
    blockIndex: number;       // index in the lesson's blocks array
    exerciseIndex: number;    // index counting only exercise blocks
    exercise: ReturnType<typeof parseLessonFile>['blocks'][number]['exercise'];
    payload: Record<string, unknown>;
  };

  const exerciseEntries: ExerciseEntry[] = [];

  for (const { slug: lessonSlug, lessonId, content } of parsedLessons) {
    let exerciseIndex = 0;
    for (let blockIndex = 0; blockIndex < content.blocks.length; blockIndex++) {
      const block = content.blocks[blockIndex];
      if (block.kind === 'exercise' && block.exercise) {
        const payloadResult = buildExercisePayload(block.exercise);
        if (payloadResult.errors.length > 0) {
          for (const e of payloadResult.errors) {
            result.errors.push(
              `Exercise ${trackSlug}/${lessonSlug}[${exerciseIndex}]: ${e.message}`,
            );
          }
        } else {
          const exerciseId = stableId(
            `exercise:${trackSlug}/${lessonSlug}/${exerciseIndex}`,
          );
          exerciseEntries.push({
            exerciseId,
            lessonId,
            lessonSlug,
            blockIndex,
            exerciseIndex,
            exercise: block.exercise,
            payload: payloadResult.payload!,
          });
        }
        exerciseIndex++;
      }
    }
  }

  // Stop before any DB writes if there are validation errors
  if (result.errors.length > 0) return result;

  // ── 4. Hash & Diff exercises, write new versions ───────────────────────────
  type WrittenExercise = { id: string; version: number };
  const writtenExercises: WrittenExercise[] = [];

  // Map exerciseId → written version for later lesson/block assembly
  const exerciseVersionMap = new Map<string, number>();

  for (const entry of exerciseEntries) {
    const hashObj: Record<string, unknown> = {
      type: entry.exercise!.type,
      kind: entry.exercise!.kind,
      payload: entry.payload,
      pointsMax: entry.exercise!.pointsMax,
      hints: entry.exercise!.hints ?? [],
      concepts: entry.exercise!.concepts ?? [],
      promptMarkdown: entry.exercise!.promptMarkdown,
    };
    const hash = contentHash(hashObj);

    const latest = await prisma.exercise.findFirst({
      where: { id: entry.exerciseId },
      orderBy: { version: 'desc' },
    });

    if (latest && latest.contentHash === hash) {
      result.skipped++;
      exerciseVersionMap.set(entry.exerciseId, latest.version);
      writtenExercises.push({ id: entry.exerciseId, version: latest.version });
      continue;
    }

    const newVersion = latest ? latest.version + 1 : 1;

    await prisma.exercise.create({
      data: {
        id: entry.exerciseId,
        version: newVersion,
        lessonId: entry.lessonId,
        promptMarkdown: entry.exercise!.promptMarkdown,
        type: entry.exercise!.kind as
          | 'code'
          | 'fix_bug'
          | 'fill_blank'
          | 'predict_output'
          | 'multiple_choice'
          | 'capstone_submission',
        payload: entry.payload,
        pointsMax: entry.exercise!.pointsMax,
        hints: entry.exercise!.hints ?? [],
        concepts: entry.exercise!.concepts ?? [],
        contentHash: hash,
      },
    });

    result.exercisesCompiled++;
    exerciseVersionMap.set(entry.exerciseId, newVersion);
    writtenExercises.push({ id: entry.exerciseId, version: newVersion });
  }

  // ── 5. Write lessons + blocks in transactions ──────────────────────────────
  type WrittenLesson = { id: string; version: number };
  const writtenLessons: WrittenLesson[] = [];
  const lessonVersionMap = new Map<string, number>();

  for (const { slug: lessonSlug, position, lessonId, content } of parsedLessons) {
    // First pass: build a version-agnostic snapshot to compute the lesson
    // hash. Block ids are NOT in the hash (they're identity, not content),
    // so we can decide newLessonVersion before assigning final block ids
    // that include the version.
    type BlockSnapshot = {
      position: number;
      kind: 'explanation' | 'exercise' | 'video';
      explanationMarkdown?: string;
      exerciseId?: string;
      exerciseVersion?: number;
      videoUrl?: string;
      videoTitle?: string;
      videoDescription?: string;
      videoDurationLabel?: string;
      videoPosterUrl?: string;
    };
    const blockSnapshots: BlockSnapshot[] = [];

    let exerciseIndexForBlock = 0;
    for (let blockIndex = 0; blockIndex < content.blocks.length; blockIndex++) {
      const block = content.blocks[blockIndex];
      if (block.kind === 'exercise') {
        const exId = stableId(
          `exercise:${trackSlug}/${lessonSlug}/${exerciseIndexForBlock}`,
        );
        const exVersion = exerciseVersionMap.get(exId) ?? 1;
        blockSnapshots.push({
          position: blockIndex,
          kind: 'exercise',
          exerciseId: exId,
          exerciseVersion: exVersion,
        });
        exerciseIndexForBlock++;
      } else if (block.kind === 'video' && block.video) {
        blockSnapshots.push({
          position: blockIndex,
          kind: 'video',
          videoUrl: block.video.url,
          videoTitle: block.video.title,
          videoDescription: block.video.description,
          videoDurationLabel: block.video.durationLabel,
          videoPosterUrl: block.video.posterUrl,
        });
      } else {
        blockSnapshots.push({
          position: blockIndex,
          kind: 'explanation',
          explanationMarkdown: block.explanationMarkdown,
        });
      }
    }

    // Compute lesson hash based on content (no block ids — those are
    // identity, derived from path, and don't represent the lesson's content)
    const lessonHashObj: Record<string, unknown> = {
      title: content.title,
      level: content.level,
      summary: content.summary,
      blocks: blockSnapshots.map((b) => ({
        kind: b.kind,
        explanationMarkdown: b.explanationMarkdown,
        exerciseId: b.exerciseId,
        exerciseVersion: b.exerciseVersion,
        videoUrl: b.videoUrl,
        videoTitle: b.videoTitle,
        videoDescription: b.videoDescription,
        videoDurationLabel: b.videoDurationLabel,
        videoPosterUrl: b.videoPosterUrl,
      })),
    };
    const lessonHash = contentHash(lessonHashObj);

    const latestLesson = await prisma.lesson.findFirst({
      where: { id: lessonId },
      orderBy: { version: 'desc' },
    });

    if (latestLesson && latestLesson.contentHash === lessonHash) {
      result.skipped++;
      lessonVersionMap.set(lessonId, latestLesson.version);
      writtenLessons.push({ id: lessonId, version: latestLesson.version });
      continue;
    }

    const newLessonVersion = latestLesson ? latestLesson.version + 1 : 1;

    // Second pass: assign block ids that include the lesson version, so
    // bumped lessons get fresh block ids and don't collide on Block.id's
    // unique constraint with the v(N-1) blocks.
    const blockIds: string[] = [];
    const blockData = blockSnapshots.map((b) => {
      const id = stableId(
        `block:${trackSlug}/${lessonSlug}/v${newLessonVersion}/${b.position}`,
      );
      blockIds.push(id);
      return {
        id,
        position: b.position,
        kind: b.kind,
        explanationMarkdown: b.explanationMarkdown,
        exerciseId: b.exerciseId,
        exerciseVersion: b.exerciseVersion,
        videoUrl: b.videoUrl,
        videoTitle: b.videoTitle,
        videoDescription: b.videoDescription,
        videoDurationLabel: b.videoDurationLabel,
        videoPosterUrl: b.videoPosterUrl,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.lesson.create({
        data: {
          id: lessonId,
          version: newLessonVersion,
          trackId: stableId(`track:${trackSlug}`),
          position,
          title: content.title,
          level: content.level as 'beginner' | 'intermediate' | 'advanced',
          summary: content.summary,
          cohortGate: content.cohortGate ?? null,
          blockIds,
          contentHash: lessonHash,
        },
      });

      await tx.block.createMany({
        data: blockData.map((b) => ({
          id: b.id,
          lessonId,
          lessonVersion: newLessonVersion,
          position: b.position,
          kind: b.kind,
          explanationMarkdown: b.explanationMarkdown,
          exerciseId: b.exerciseId,
          exerciseVersion: b.exerciseVersion,
          videoUrl: b.videoUrl,
          videoTitle: b.videoTitle,
          videoDescription: b.videoDescription,
          videoDurationLabel: b.videoDurationLabel,
          videoPosterUrl: b.videoPosterUrl,
        })),
      });
    });

    result.lessonsCompiled++;
    lessonVersionMap.set(lessonId, newLessonVersion);
    writtenLessons.push({ id: lessonId, version: newLessonVersion });
  }

  // ── 6. Write track ─────────────────────────────────────────────────────────
  const trackId = stableId(`track:${trackSlug}`);
  const lessonIds = parsedLessons.map((l) => l.lessonId);
  const lessonVersionsArr = parsedLessons.map((l) => lessonVersionMap.get(l.lessonId) ?? 1);

  const trackHashObj: Record<string, unknown> = {
    title: trackMeta.title,
    language: trackMeta.language,
    kind: trackMeta.kind,
    description: trackMeta.description,
    lessonIds,
    lessonVersions: lessonVersionsArr,
  };
  const trackHash = contentHash(trackHashObj);

  const latestTrack = await prisma.track.findFirst({
    where: { id: trackId },
    orderBy: { version: 'desc' },
  });

  let trackVersion: number;
  if (latestTrack && latestTrack.contentHash === trackHash) {
    result.skipped++;
    trackVersion = latestTrack.version;
  } else {
    trackVersion = latestTrack ? latestTrack.version + 1 : 1;
    await prisma.track.create({
      data: {
        id: trackId,
        version: trackVersion,
        title: trackMeta.title,
        language: trackMeta.language,
        kind: trackMeta.kind,
        description: trackMeta.description,
        lessonIds,
        lessonVersions: lessonVersionsArr,
        contentHash: trackHash,
        starterRepoUrl: trackMeta.starterRepoUrl ?? null,
      },
    });
    result.tracksCompiled++;
  }

  // ── 7. Publish if requested ────────────────────────────────────────────────
  if (options.publish) {
    await publishTrack(prisma, trackId, trackVersion, writtenLessons, writtenExercises);
  }

  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function compileTrack(
  prisma: PrismaClient,
  curriculumDir: string,
  trackSlug: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  return compileTrackInternal(prisma, curriculumDir, trackSlug, options);
}

export async function compileAll(
  curriculumDir: string,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const prisma = new PrismaClient();
  const aggregate: CompileResult = {
    tracksCompiled: 0,
    lessonsCompiled: 0,
    exercisesCompiled: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const slugs = discoverTrackSlugs(curriculumDir);
    for (const slug of slugs) {
      const r = await compileTrackInternal(prisma, curriculumDir, slug, options);
      aggregate.tracksCompiled += r.tracksCompiled;
      aggregate.lessonsCompiled += r.lessonsCompiled;
      aggregate.exercisesCompiled += r.exercisesCompiled;
      aggregate.skipped += r.skipped;
      aggregate.errors.push(...r.errors);
    }
  } finally {
    await prisma.$disconnect();
  }

  return aggregate;
}

// ── compileLesson — synchronous parse + validate (no DB) ──────────────────────

/**
 * Parse and validate a lesson markdown string without writing to the database.
 *
 * Used by unit tests and tooling that needs to verify a lesson is well-formed
 * before committing it to the compile pipeline. Throws on the first error.
 *
 * @returns The parsed lesson if valid.
 */
export function compileLesson(markdown: string): ReturnType<typeof parseLessonFile> {
  const lesson = parseLessonFile(markdown);
  validateLesson(lesson);
  return lesson;
}
