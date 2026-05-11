import type { ExerciseMeta, ParsedLesson } from './parser.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationError = { message: string };

export type PayloadResult = {
  payload: Record<string, unknown> | null;
  errors: ValidationError[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultTestEntryPoint(language: string | undefined): string {
  if (language === 'kotlin') return 'TestKt';
  return 'Tests'; // swift and anything else
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildExercisePayload(exercise: ExerciseMeta): PayloadResult {
  const errors: ValidationError[] = [];
  const { kind, language, codeFences, testEntryPoint, expectedOutput, blanks, tokens, multipleChoice } =
    exercise;

  switch (kind) {
    case 'code': {
      if (!codeFences.starter) {
        errors.push({ message: 'code exercise missing starter code fence' });
      }
      if (!codeFences.test) {
        errors.push({ message: 'code exercise missing test code fence' });
      }
      if (errors.length > 0) return { payload: null, errors };

      return {
        payload: {
          type: 'code',
          language,
          starterCode: codeFences.starter,
          testCode: codeFences.test,
          testEntryPoint: testEntryPoint ?? defaultTestEntryPoint(language),
        },
        errors,
      };
    }

    case 'fix_bug': {
      if (!codeFences.broken) {
        errors.push({ message: 'fix_bug exercise missing broken code fence' });
      }
      if (!codeFences.test) {
        errors.push({ message: 'fix_bug exercise missing test code fence' });
      }
      if (errors.length > 0) return { payload: null, errors };

      return {
        payload: {
          type: 'fix_bug',
          language,
          brokenCode: codeFences.broken,
          testCode: codeFences.test,
          testEntryPoint: testEntryPoint ?? defaultTestEntryPoint(language),
        },
        errors,
      };
    }

    case 'fill_blank': {
      if (!codeFences.starter) {
        errors.push({ message: 'fill_blank exercise missing starter code fence' });
      }
      if (!blanks || Object.keys(blanks).length === 0) {
        errors.push({ message: 'fill_blank exercise missing blanks in frontmatter' });
      }
      if (errors.length > 0) return { payload: null, errors };

      // Convert Record<string, string[]> → Array<{ id: string; expected: string[] }>
      const blanksArray = Object.entries(blanks!).map(([id, expected]) => ({ id, expected }));

      const payload: Record<string, unknown> = {
        type: 'fill_blank',
        language,
        template: codeFences.starter,
        blanks: blanksArray,
      };
      // Only include `tokens` when authored — keeps existing payloads byte-stable
      // and lets the renderer fall back to deriving from blanks.
      if (tokens && tokens.length > 0) payload.tokens = tokens;

      return { payload, errors };
    }

    case 'predict_output': {
      if (!codeFences.starter) {
        errors.push({ message: 'predict_output exercise missing starter code fence' });
      }
      if (expectedOutput === undefined || expectedOutput === null || expectedOutput === '') {
        errors.push({ message: 'predict_output exercise missing expectedOutput in frontmatter' });
      }
      if (errors.length > 0) return { payload: null, errors };

      return {
        payload: {
          type: 'predict_output',
          displayedCode: codeFences.starter,
          displayedLanguage: language,
          expectedOutput,
        },
        errors,
      };
    }

    case 'multiple_choice': {
      if (!multipleChoice) {
        errors.push({ message: 'multiple_choice exercise missing multipleChoice data' });
      }
      if (errors.length > 0) return { payload: null, errors };

      const { questionMarkdown, options, correctOptionIds, multiSelect } = multipleChoice!;

      return {
        payload: {
          type: 'multiple_choice',
          questionMarkdown,
          options,
          correctOptionIds,
          multiSelect,
        },
        errors,
      };
    }

    case 'capstone_submission': {
      return {
        payload: { type: 'capstone_submission' },
        errors: [],
      };
    }

    case 'visual_playground': {
      // Visual playgrounds carry their entire config in a `playground:` block
      // in frontmatter. We pass it through; the platform's zod validator is
      // the source of truth for shape.
      const playground = exercise.playground;
      if (!playground) {
        errors.push({ message: 'visual_playground exercise missing `playground` config in frontmatter' });
        return { payload: null, errors };
      }
      return {
        payload: {
          type: 'visual_playground',
          language,
          ...playground,
        },
        errors,
      };
    }

    default: {
      errors.push({ message: `unknown exercise kind: "${kind}"` });
      return { payload: null, errors };
    }
  }
}

// ── Lesson-level validation ────────────────────────────────────────────────────

const VALID_COHORT_GATES = ['four_week', 'twelve_week'] as const;

/**
 * Validate lesson-level constraints that are checked at compile time:
 *   1. Pool size must be >= 4 unless the lesson's sole exercise is capstone_submission.
 *   2. cohortGate, if present, must be "four_week" or "twelve_week".
 *
 * Throws an Error on the first constraint violation.
 */
export function validateLesson(lesson: ParsedLesson): void {
  // ── cohortGate ─────────────────────────────────────────────────────────────
  if (lesson.cohortGate !== undefined && lesson.cohortGate !== null) {
    if (!(VALID_COHORT_GATES as readonly string[]).includes(lesson.cohortGate)) {
      throw new Error(
        `Lesson "${lesson.title}": cohortGate "${lesson.cohortGate}" invalid. Must be "four_week" or "twelve_week".`,
      );
    }
  }

  // ── Video blocks ──────────────────────────────────────────────────────────
  // The parser silently drops video sections without a URL to avoid producing
  // malformed blocks; surface that here as a hard error so authors know.
  const videoBlocks = lesson.blocks.filter((b) => b.kind === 'video');
  for (const v of videoBlocks) {
    if (!v.video || !v.video.url || v.video.url.trim() === '') {
      throw new Error(`Lesson "${lesson.title}": video block missing required \`url\`.`);
    }
  }

  // ── Pool size ──────────────────────────────────────────────────────────────
  const exerciseBlocks = lesson.blocks.filter((b) => b.kind === 'exercise');
  // Single-exercise lessons are allowed when the sole exercise is a
  // capstone_submission milestone OR a visual_playground (an open-ended
  // exploration block — also a single-step lesson by design).
  const isSingletonAllowed =
    exerciseBlocks.length === 1 &&
    (exerciseBlocks[0].exercise?.kind === 'capstone_submission' ||
      exerciseBlocks[0].exercise?.kind === 'visual_playground');

  if (!isSingletonAllowed && exerciseBlocks.length < 4) {
    throw new Error(
      `Lesson "${lesson.title}": pool size ${exerciseBlocks.length} < 4. Author at least 4 exercises (or make it a single capstone_submission / visual_playground).`,
    );
  }
}
