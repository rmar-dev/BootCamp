import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compileTrack } from '../src/compiler.js';
import { stableId } from '../src/hasher.js';

// ── DB setup ──────────────────────────────────────────────────────────────────

process.env.DATABASE_URL =
  'postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public';

const prisma = new PrismaClient();

// ── IDs derived from the test track slug ─────────────────────────────────────

const TRACK_SLUG = 'test-track';
const LESSON_SLUG = 'test-lesson';

const trackId = stableId(`track:${TRACK_SLUG}`);
const lessonId = stableId(`lesson:${TRACK_SLUG}/${LESSON_SLUG}`);
const blockId0 = stableId(`block:${TRACK_SLUG}/${LESSON_SLUG}/0`);
const blockId1 = stableId(`block:${TRACK_SLUG}/${LESSON_SLUG}/1`);
const blockId2 = stableId(`block:${TRACK_SLUG}/${LESSON_SLUG}/2`);
const blockId3 = stableId(`block:${TRACK_SLUG}/${LESSON_SLUG}/3`);
const blockId4 = stableId(`block:${TRACK_SLUG}/${LESSON_SLUG}/4`);
const exerciseId = stableId(`exercise:${TRACK_SLUG}/${LESSON_SLUG}/0`);
const exerciseId1 = stableId(`exercise:${TRACK_SLUG}/${LESSON_SLUG}/1`);
const exerciseId2 = stableId(`exercise:${TRACK_SLUG}/${LESSON_SLUG}/2`);
const exerciseId3 = stableId(`exercise:${TRACK_SLUG}/${LESSON_SLUG}/3`);

// ── Fixture content ───────────────────────────────────────────────────────────

const TRACK_MD = `---
id: ${TRACK_SLUG}
title: Test Track
language: swift
kind: fundamentals
description: Integration test track.
lessons:
  - ${LESSON_SLUG}
---
`;

function makeLessonMd(prompt = 'Write hello.'): string {
  // Pool-size validation requires >= 4 exercises per lesson.
  // Exercise 0 uses the caller-supplied prompt; exercises 1–3 are fixed filler
  // so the fixture satisfies the constraint without changing what any test asserts.
  return `---
type: lesson
title: Test Lesson
level: beginner
summary: A test
---

# Hello

Welcome.
---
type: exercise
kind: code
language: swift
pointsMax: 100
---

${prompt}

\`\`\`swift:starter
func hello() -> String { return "" }
\`\`\`

\`\`\`swift:test
bootcampAssertEqual(hello(), "hi", "test")
\`\`\`
---
type: exercise
kind: code
language: swift
pointsMax: 100
---

Write a function that returns 42.

\`\`\`swift:starter
func answer() -> Int { return 0 }
\`\`\`

\`\`\`swift:test
bootcampAssertEqual(answer(), 42, "test")
\`\`\`
---
type: exercise
kind: code
language: swift
pointsMax: 100
---

Write a function that returns true.

\`\`\`swift:starter
func truth() -> Bool { return false }
\`\`\`

\`\`\`swift:test
bootcampAssertEqual(truth(), true, "test")
\`\`\`
---
type: exercise
kind: code
language: swift
pointsMax: 100
---

Write a function that returns an empty array.

\`\`\`swift:starter
func empty() -> [Int] { return [1] }
\`\`\`

\`\`\`swift:test
bootcampAssertEqual(empty(), [], "test")
\`\`\`
`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(tmpdir(), `bootcamp-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeTrack(curriculumDir: string, lessonMd = makeLessonMd()): void {
  const trackDir = join(curriculumDir, TRACK_SLUG);
  mkdirSync(trackDir, { recursive: true });
  writeFileSync(join(trackDir, 'track.md'), TRACK_MD, 'utf-8');
  writeFileSync(join(trackDir, `${LESSON_SLUG}.md`), lessonMd, 'utf-8');
}

async function cleanupDb(): Promise<void> {
  // Delete in FK-safe order. Blocks are matched by lessonId so this catches
  // any version's block ids (the compiler now puts the lesson version into
  // the block path, so v1/v2/... use different block UUIDs).
  await prisma.block.deleteMany({ where: { lessonId } });
  await prisma.exercise.deleteMany({ where: { id: { in: [exerciseId, exerciseId1, exerciseId2, exerciseId3] } } });
  await prisma.lesson.deleteMany({ where: { id: lessonId } });
  await prisma.track.deleteMany({ where: { id: trackId } });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanupDb();
});

afterAll(async () => {
  await cleanupDb();
  await prisma.$disconnect();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('compileTrack integration', () => {
  it('compiles a simple track and writes correct DB records', async () => {
    const dir = makeTempDir();
    try {
      writeTrack(dir);

      const result = await compileTrack(prisma, dir, TRACK_SLUG, {});

      // No errors
      expect(result.errors).toHaveLength(0);

      // Counts — makeLessonMd produces 4 exercises to satisfy pool-size validation
      expect(result.tracksCompiled).toBe(1);
      expect(result.lessonsCompiled).toBe(1);
      expect(result.exercisesCompiled).toBe(4);
      expect(result.skipped).toBe(0);

      // Track in DB
      const track = await prisma.track.findFirst({ where: { id: trackId } });
      expect(track).not.toBeNull();
      expect(track!.title).toBe('Test Track');
      expect(track!.language).toBe('swift');
      expect(track!.publishedAt).toBeNull();

      // Lesson in DB
      const lesson = await prisma.lesson.findFirst({ where: { id: lessonId } });
      expect(lesson).not.toBeNull();
      expect(lesson!.title).toBe('Test Lesson');
      expect(lesson!.level).toBe('beginner');
      expect(lesson!.publishedAt).toBeNull();

      // Exercise in DB
      const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId } });
      expect(exercise).not.toBeNull();
      expect(exercise!.type).toBe('code');
      expect(exercise!.pointsMax).toBe(100);
      expect(exercise!.publishedAt).toBeNull();
      expect(exercise!.version).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent — second compile skips everything', async () => {
    const dir = makeTempDir();
    try {
      writeTrack(dir);

      await compileTrack(prisma, dir, TRACK_SLUG, {});
      const second = await compileTrack(prisma, dir, TRACK_SLUG, {});

      expect(second.errors).toHaveLength(0);
      expect(second.tracksCompiled).toBe(0);
      expect(second.lessonsCompiled).toBe(0);
      expect(second.exercisesCompiled).toBe(0);
      expect(second.skipped).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('bumps exercise version when prompt changes, leaves unchanged exercise alone', async () => {
    const dir = makeTempDir();
    try {
      writeTrack(dir, makeLessonMd('Write hello.'));
      await compileTrack(prisma, dir, TRACK_SLUG, {});

      // Change the exercise prompt
      writeTrack(dir, makeLessonMd('Write hello world.'));
      const second = await compileTrack(prisma, dir, TRACK_SLUG, {});

      expect(second.errors).toHaveLength(0);
      expect(second.exercisesCompiled).toBe(1);

      // Exercise should now have version 2
      const exercises = await prisma.exercise.findMany({
        where: { id: exerciseId },
        orderBy: { version: 'desc' },
      });
      expect(exercises[0].version).toBe(2);
      expect(exercises).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sets publishedAt when compiled with publish: true', async () => {
    const dir = makeTempDir();
    try {
      writeTrack(dir);
      const result = await compileTrack(prisma, dir, TRACK_SLUG, { publish: true });

      expect(result.errors).toHaveLength(0);

      const track = await prisma.track.findFirst({ where: { id: trackId } });
      expect(track!.publishedAt).not.toBeNull();

      const lesson = await prisma.lesson.findFirst({ where: { id: lessonId } });
      expect(lesson!.publishedAt).not.toBeNull();

      const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId } });
      expect(exercise!.publishedAt).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns validation errors and writes nothing to DB when code fences are missing', async () => {
    const dir = makeTempDir();
    try {
      // Lesson with 4 code exercises that all have no code fences.
      // Pool-size validation passes (>= 4), but payload validation must reject each
      // for the missing starter/test fences — keeping the original assertion green.
      const badLesson = `---
type: lesson
title: Bad Lesson
level: beginner
summary: Missing fences
---
---
type: exercise
kind: code
language: swift
pointsMax: 50
---

Write something.
---
type: exercise
kind: code
language: swift
pointsMax: 50
---

Write something else.
---
type: exercise
kind: code
language: swift
pointsMax: 50
---

Write another thing.
---
type: exercise
kind: code
language: swift
pointsMax: 50
---

Write one more thing.
`;
      const trackDir = join(dir, TRACK_SLUG);
      mkdirSync(trackDir, { recursive: true });
      writeFileSync(join(trackDir, 'track.md'), TRACK_MD, 'utf-8');
      writeFileSync(join(trackDir, `${LESSON_SLUG}.md`), badLesson, 'utf-8');

      const result = await compileTrack(prisma, dir, TRACK_SLUG, {});

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('starter'))).toBe(true);

      // Nothing written to DB
      const track = await prisma.track.findFirst({ where: { id: trackId } });
      expect(track).toBeNull();

      const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId } });
      expect(exercise).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
