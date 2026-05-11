import { describe, it, expect } from 'vitest';
import { compileLesson } from '../src/compiler.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal multiple_choice exercise block (includes option lines so the
 *  parser attaches multipleChoice data, satisfying buildExercisePayload). */
function mcBlock(n: number): string {
  return `
---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Question ${n}?
- [x] a
- [ ] b
`;
}

/** Build a lesson with N multiple_choice exercises. */
function lessonWithNExercises(n: number, extra = ''): string {
  const header = `---
type: lesson
title: Test Lesson
level: beginner
summary: s${extra ? `\n${extra}` : ''}
---
# Title
`;
  return header + mcBlock(1).repeat(n);
}

// ── Pool size validation ───────────────────────────────────────────────────────

describe('compileLesson — pool size validation', () => {
  it('rejects a lesson with fewer than 4 exercises that are not capstone_submission', () => {
    const markdown = `---
type: lesson
title: Tiny
level: beginner
summary: s
---
# Title
---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Question?
- [ ] a
- [x] b
`;
    expect(() => compileLesson(markdown)).toThrow(/pool size.*at least 4/i);
  });

  it('rejects a lesson with 2 exercises (below minimum)', () => {
    expect(() => compileLesson(lessonWithNExercises(2))).toThrow(/pool size.*at least 4/i);
  });

  it('rejects a lesson with 3 exercises (still below minimum)', () => {
    expect(() => compileLesson(lessonWithNExercises(3))).toThrow(/pool size.*at least 4/i);
  });

  it('accepts a lesson with exactly 4 exercises', () => {
    expect(() => compileLesson(lessonWithNExercises(4))).not.toThrow();
  });

  it('accepts a lesson with more than 4 exercises', () => {
    expect(() => compileLesson(lessonWithNExercises(6))).not.toThrow();
  });

  it('allows a single capstone_submission exercise lesson', () => {
    const markdown = `---
type: lesson
title: Milestone
level: beginner
summary: s
---
# Milestone 1
---
type: exercise
kind: capstone_submission
pointsMax: 50
---
Submit your repo.
`;
    expect(() => compileLesson(markdown)).not.toThrow();
  });

  it('rejects a lesson with 0 exercises (no capstone exemption)', () => {
    const markdown = `---
type: lesson
title: Empty
level: beginner
summary: s
---
Just some explanation text, no exercises.
`;
    expect(() => compileLesson(markdown)).toThrow(/pool size.*at least 4/i);
  });
});

// ── cohortGate validation ─────────────────────────────────────────────────────

describe('compileLesson — cohortGate validation', () => {
  it('rejects an invalid cohortGate value', () => {
    const markdown = `---
type: lesson
title: Depth
level: intermediate
summary: s
cohortGate: eight_week
---
# Topic
${mcBlock(1).repeat(4)}`;
    expect(() => compileLesson(markdown)).toThrow(/cohortGate.*invalid/i);
  });

  it('accepts cohortGate: four_week on a lesson with 4+ exercises', () => {
    expect(() =>
      compileLesson(lessonWithNExercises(4, 'cohortGate: four_week')),
    ).not.toThrow();
  });

  it('accepts cohortGate: twelve_week on a lesson with 4+ exercises', () => {
    const exerciseBlock = mcBlock(1);
    const markdown = `---
type: lesson
title: Depth
level: intermediate
summary: s
cohortGate: twelve_week
---
# Topic
${exerciseBlock.repeat(4)}`;
    expect(() => compileLesson(markdown)).not.toThrow();
  });

  it('accepts a lesson with no cohortGate field', () => {
    expect(() => compileLesson(lessonWithNExercises(4))).not.toThrow();
  });

  it('rejects cohortGate: monthly (arbitrary invalid value)', () => {
    const markdown = `---
type: lesson
title: Bad Gate
level: beginner
summary: s
cohortGate: monthly
---
# Topic
${mcBlock(1).repeat(4)}`;
    expect(() => compileLesson(markdown)).toThrow(/cohortGate.*invalid/i);
  });
});
