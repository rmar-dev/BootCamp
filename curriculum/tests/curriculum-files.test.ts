/**
 * End-to-end "every track on disk parses and validates" suite.
 *
 * Walks `curriculum/` for any folder containing a `track.md`, then for each
 * lesson listed in that track:
 *   1. Parses the lesson markdown.
 *   2. Runs `validateLesson` (pool size + cohortGate + video blocks).
 *   3. Builds the payload for every exercise (catches missing code fences,
 *      missing expectedOutput on predict_output, etc).
 *
 * Failures point at the offending file so authors can fix in place. This is
 * what catches a YAML mistake (e.g. an unquoted title starting with `@`)
 * before it ships to the database.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTrackFile, parseLessonFile } from '../src/parser.js';
import { buildExercisePayload, validateLesson } from '../src/validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const curriculumDir = resolve(__dirname, '..');

function listTrackSlugs(): string[] {
  return readdirSync(curriculumDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => existsSync(join(curriculumDir, e.name, 'track.md')))
    .map((e) => e.name);
}

const trackSlugs = listTrackSlugs();

describe('curriculum on-disk validation', () => {
  it('discovers at least one track', () => {
    expect(trackSlugs.length).toBeGreaterThan(0);
  });

  describe.each(trackSlugs)('track: %s', (slug) => {
    const trackPath = join(curriculumDir, slug, 'track.md');
    const trackMeta = parseTrackFile(readFileSync(trackPath, 'utf-8'));

    it('track.md parses with a non-empty lessons array', () => {
      expect(trackMeta.lessons.length).toBeGreaterThan(0);
    });

    describe.each(trackMeta.lessons)('lesson: %s', (lessonSlug) => {
      const lessonPath = join(curriculumDir, slug, `${lessonSlug}.md`);

      it('lesson file exists', () => {
        expect(existsSync(lessonPath)).toBe(true);
      });

      it('parses and validates', () => {
        const raw = readFileSync(lessonPath, 'utf-8');
        const lesson = parseLessonFile(raw);
        expect(() => validateLesson(lesson)).not.toThrow();
      });

      it('every exercise builds a valid payload', () => {
        const raw = readFileSync(lessonPath, 'utf-8');
        const lesson = parseLessonFile(raw);
        for (const block of lesson.blocks) {
          if (block.kind !== 'exercise' || !block.exercise) continue;
          const { payload, errors } = buildExercisePayload(block.exercise);
          // Surface specific errors so CI logs are immediately actionable.
          if (errors.length > 0) {
            throw new Error(
              `[${slug}/${lessonSlug}] exercise payload errors: ${errors.map((e) => e.message).join(', ')}`,
            );
          }
          expect(payload).not.toBeNull();
        }
      });
    });
  });
});
