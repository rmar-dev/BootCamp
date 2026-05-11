import { describe, it, expect } from 'vitest';
import { buildExercisePayload, validateLesson } from '../src/validator.js';
import type { ExerciseMeta, ParsedLesson } from '../src/parser.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBase(kind: string, language: 'swift' | 'kotlin' = 'swift'): ExerciseMeta {
  return {
    type: 'exercise',
    kind,
    language,
    pointsMax: 10,
    promptMarkdown: 'Do the thing.',
    codeFences: {},
  };
}

// ── code ──────────────────────────────────────────────────────────────────────

describe('buildExercisePayload – code', () => {
  it('builds a valid swift code payload with default testEntryPoint', () => {
    const ex: ExerciseMeta = {
      ...makeBase('code', 'swift'),
      codeFences: { starter: 'func foo() {}', test: 'class Tests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({
      type: 'code',
      language: 'swift',
      starterCode: 'func foo() {}',
      testCode: 'class Tests {}',
      testEntryPoint: 'Tests',
    });
  });

  it('builds a valid kotlin code payload with default testEntryPoint', () => {
    const ex: ExerciseMeta = {
      ...makeBase('code', 'kotlin'),
      codeFences: { starter: 'fun foo() {}', test: 'class TestKt {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({ type: 'code', testEntryPoint: 'TestKt' });
  });

  it('respects a custom testEntryPoint from frontmatter', () => {
    const ex: ExerciseMeta = {
      ...makeBase('code', 'swift'),
      testEntryPoint: 'MyCustomTests',
      codeFences: { starter: 'func foo() {}', test: 'class MyCustomTests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload?.testEntryPoint).toBe('MyCustomTests');
  });

  it('returns errors when starter fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('code'),
      codeFences: { test: 'class Tests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'code exercise missing starter code fence' });
  });

  it('returns errors when test fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('code'),
      codeFences: { starter: 'func foo() {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'code exercise missing test code fence' });
  });

  it('returns both errors when both fences are missing', () => {
    const ex: ExerciseMeta = { ...makeBase('code'), codeFences: {} };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toHaveLength(2);
  });
});

// ── fix_bug ───────────────────────────────────────────────────────────────────

describe('buildExercisePayload – fix_bug', () => {
  it('builds a valid fix_bug payload', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fix_bug', 'swift'),
      codeFences: { broken: 'func foo( {}', test: 'class Tests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({
      type: 'fix_bug',
      language: 'swift',
      brokenCode: 'func foo( {}',
      testCode: 'class Tests {}',
      testEntryPoint: 'Tests',
    });
  });

  it('respects custom testEntryPoint for fix_bug', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fix_bug', 'kotlin'),
      testEntryPoint: 'SpecialTests',
      codeFences: { broken: 'fun foo( {}', test: 'class SpecialTests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload?.testEntryPoint).toBe('SpecialTests');
  });

  it('returns error when broken fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fix_bug'),
      codeFences: { test: 'class Tests {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'fix_bug exercise missing broken code fence' });
  });

  it('returns error when test fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fix_bug'),
      codeFences: { broken: 'func foo( {}' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'fix_bug exercise missing test code fence' });
  });
});

// ── fill_blank ────────────────────────────────────────────────────────────────

describe('buildExercisePayload – fill_blank', () => {
  it('builds a valid fill_blank payload converting blanks record to array', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fill_blank', 'swift'),
      codeFences: { starter: 'let x: ___ = ___' },
      blanks: { blank1: ['Int'], blank2: ['42', '0'] },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({
      type: 'fill_blank',
      language: 'swift',
      template: 'let x: ___ = ___',
    });
    const blanks = payload?.blanks as Array<{ id: string; expected: string[] }>;
    expect(blanks).toHaveLength(2);
    expect(blanks).toContainEqual({ id: 'blank1', expected: ['Int'] });
    expect(blanks).toContainEqual({ id: 'blank2', expected: ['42', '0'] });
  });

  it('returns error when starter fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fill_blank'),
      codeFences: {},
      blanks: { b1: ['val'] },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'fill_blank exercise missing starter code fence' });
  });

  it('returns error when blanks are missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('fill_blank'),
      codeFences: { starter: 'let x = ___' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({ message: 'fill_blank exercise missing blanks in frontmatter' });
  });
});

// ── predict_output ────────────────────────────────────────────────────────────

describe('buildExercisePayload – predict_output', () => {
  it('builds a valid predict_output payload', () => {
    const ex: ExerciseMeta = {
      ...makeBase('predict_output', 'kotlin'),
      codeFences: { starter: 'println("hello")' },
      expectedOutput: 'hello',
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({
      type: 'predict_output',
      displayedCode: 'println("hello")',
      displayedLanguage: 'kotlin',
      expectedOutput: 'hello',
    });
  });

  it('returns error when starter fence is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('predict_output'),
      codeFences: {},
      expectedOutput: 'hello',
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({
      message: 'predict_output exercise missing starter code fence',
    });
  });

  it('returns error when expectedOutput is missing', () => {
    const ex: ExerciseMeta = {
      ...makeBase('predict_output'),
      codeFences: { starter: 'println("hello")' },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({
      message: 'predict_output exercise missing expectedOutput in frontmatter',
    });
  });
});

// ── multiple_choice ───────────────────────────────────────────────────────────

describe('buildExercisePayload – multiple_choice', () => {
  it('builds a valid multiple_choice payload (single correct answer)', () => {
    const ex: ExerciseMeta = {
      ...makeBase('multiple_choice'),
      codeFences: {},
      multipleChoice: {
        questionMarkdown: 'Which keyword declares a constant in Swift?',
        options: [
          { id: 'opt-0', text: 'var' },
          { id: 'opt-1', text: 'let' },
          { id: 'opt-2', text: 'val' },
        ],
        correctOptionIds: ['opt-1'],
        multiSelect: false,
      },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload).toMatchObject({
      type: 'multiple_choice',
      questionMarkdown: 'Which keyword declares a constant in Swift?',
      correctOptionIds: ['opt-1'],
      multiSelect: false,
    });
    const opts = payload?.options as Array<{ id: string; text: string }>;
    expect(opts).toHaveLength(3);
  });

  it('builds a valid multiple_choice payload (multiSelect)', () => {
    const ex: ExerciseMeta = {
      ...makeBase('multiple_choice'),
      codeFences: {},
      multipleChoice: {
        questionMarkdown: 'Which are value types in Swift?',
        options: [
          { id: 'opt-0', text: 'struct' },
          { id: 'opt-1', text: 'class' },
          { id: 'opt-2', text: 'enum' },
        ],
        correctOptionIds: ['opt-0', 'opt-2'],
        multiSelect: true,
      },
    };
    const { payload, errors } = buildExercisePayload(ex);
    expect(errors).toHaveLength(0);
    expect(payload?.multiSelect).toBe(true);
    expect(payload?.correctOptionIds).toEqual(['opt-0', 'opt-2']);
  });

  it('returns error when multipleChoice data is absent', () => {
    const ex: ExerciseMeta = { ...makeBase('multiple_choice'), codeFences: {} };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors).toContainEqual({
      message: 'multiple_choice exercise missing multipleChoice data',
    });
  });
});

// ── unknown kind ──────────────────────────────────────────────────────────────

describe('buildExercisePayload – unknown kind', () => {
  it('returns an error for an unrecognised exercise kind', () => {
    const ex: ExerciseMeta = { ...makeBase('drag_drop'), codeFences: {} };
    const { payload, errors } = buildExercisePayload(ex);
    expect(payload).toBeNull();
    expect(errors[0].message).toMatch(/unknown exercise kind/);
  });
});

// ── validateLesson — video blocks ─────────────────────────────────────────────

describe('validateLesson – video blocks', () => {
  function lessonWith(blocks: ParsedLesson['blocks']): ParsedLesson {
    return { title: 'L', level: 'beginner', summary: 's', blocks };
  }

  function exerciseBlock(): ParsedLesson['blocks'][number] {
    return {
      kind: 'exercise',
      exercise: {
        type: 'exercise', kind: 'multiple_choice', pointsMax: 1,
        promptMarkdown: '?', codeFences: {},
        multipleChoice: {
          questionMarkdown: '?',
          options: [{ id: 'opt-0', text: 'a' }, { id: 'opt-1', text: 'b' }],
          correctOptionIds: ['opt-0'],
          multiSelect: false,
        },
      },
    };
  }

  it('accepts a lesson with a video block + four exercise blocks', () => {
    const lesson = lessonWith([
      { kind: 'video', video: { url: 'https://www.youtube.com/watch?v=abc123' } },
      exerciseBlock(), exerciseBlock(), exerciseBlock(), exerciseBlock(),
    ]);
    expect(() => validateLesson(lesson)).not.toThrow();
  });

  it('throws when a video block has no url', () => {
    const lesson = lessonWith([
      { kind: 'video', video: { url: '' } },
      exerciseBlock(), exerciseBlock(), exerciseBlock(), exerciseBlock(),
    ]);
    expect(() => validateLesson(lesson)).toThrow(/video block missing required `url`/);
  });

  it('throws when the video field is omitted entirely', () => {
    const lesson = lessonWith([
      { kind: 'video' },
      exerciseBlock(), exerciseBlock(), exerciseBlock(), exerciseBlock(),
    ]);
    expect(() => validateLesson(lesson)).toThrow(/video block missing required `url`/);
  });

  it('does not count video blocks toward the pool-size minimum', () => {
    const lesson = lessonWith([
      { kind: 'video', video: { url: 'https://vimeo.com/76979871' } },
      exerciseBlock(),
    ]);
    // Two non-capstone exercises < 4 → must still throw the pool-size error.
    expect(() => validateLesson(lesson)).toThrow(/pool size 1 < 4/);
  });
});
