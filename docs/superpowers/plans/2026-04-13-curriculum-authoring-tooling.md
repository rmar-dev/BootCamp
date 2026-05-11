# Curriculum Authoring Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone TypeScript compiler that reads curriculum authored as markdown-with-frontmatter files and upserts directly into the Postgres database, with content-addressed hashing for versioning.

**Architecture:** Standalone script at `curriculum/compile.ts` with its own `package.json`. Parses markdown files, validates exercise payloads via Zod schemas imported from the platform, computes content hashes, diffs against DB, and upserts via Prisma Client. Optional `--publish` flag publishes new versions.

**Tech Stack:** TypeScript, Prisma Client (reuses platform schema), gray-matter (frontmatter parsing), uuid v5 (deterministic IDs), tsx (runner), Vitest (tests), crypto (SHA-256 hashing).

---

## File Structure

### Platform (modified)

| File | Responsibility |
|------|---------------|
| `platform/prisma/schema.prisma` | Add `contentHash` field to Track, Lesson, Exercise (modify) |

### Curriculum (new directory)

| File | Responsibility |
|------|---------------|
| `curriculum/package.json` | Dependencies and scripts |
| `curriculum/tsconfig.json` | TypeScript config resolving platform imports |
| `curriculum/src/parser.ts` | Markdown file parsing — split on `---`, classify blocks, extract code fences |
| `curriculum/src/hasher.ts` | Deterministic UUID5 IDs and SHA-256 content hashing |
| `curriculum/src/validator.ts` | Build exercise payloads from parsed blocks, validate via Zod |
| `curriculum/src/compiler.ts` | Core pipeline — discovery, parsing, validation, diffing, upsert |
| `curriculum/src/publisher.ts` | Publish logic — set publishedAt on new versions |
| `curriculum/compile.ts` | CLI entry point — arg parsing, run compiler |
| `curriculum/tests/parser.test.ts` | Parser unit tests |
| `curriculum/tests/hasher.test.ts` | Hasher unit tests |
| `curriculum/tests/validator.test.ts` | Validator unit tests |
| `curriculum/tests/compiler.test.ts` | Integration tests (require DB) |

### Sample curriculum

| File | Responsibility |
|------|---------------|
| `curriculum/swift-fundamentals/track.md` | Sample track metadata |
| `curriculum/swift-fundamentals/01-intro.md` | Sample lesson with all 5 exercise types |
| `curriculum/swift-fundamentals/02-functions.md` | Sample lesson with code exercises |

---

## Task 1: Schema Change — Add contentHash

**Files:**
- Modify: `platform/prisma/schema.prisma`

- [ ] **Step 1: Add contentHash to Track, Lesson, and Exercise**

In `platform/prisma/schema.prisma`, add `contentHash String?` to each model.

For Track (after `publishedAt`):
```prisma
  contentHash  String?
```

For Lesson (after `publishedAt`):
```prisma
  contentHash  String?
```

For Exercise (after `publishedAt`):
```prisma
  contentHash  String?
```

- [ ] **Step 2: Run migration**

Run: `cd platform && npx prisma migrate dev --name add-content-hash`
Expected: Migration created and applied.

- [ ] **Step 3: Run existing tests**

Run: `cd platform && npm test`
Expected: All 187 tests pass (nullable field, no behavior change).

- [ ] **Step 4: Commit**

```bash
cd platform
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add contentHash field to Track, Lesson, Exercise"
```

---

## Task 2: Curriculum Project Setup

**Files:**
- Create: `curriculum/package.json`
- Create: `curriculum/tsconfig.json`

- [ ] **Step 1: Create package.json**

Create `curriculum/package.json`:

```json
{
  "name": "bootcamp-curriculum",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compile": "tsx compile.ts",
    "compile:publish": "tsx compile.ts --publish",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "gray-matter": "^4.0.3",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `curriculum/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@platform/*": ["../platform/src/*"]
    },
    "skipLibCheck": true
  },
  "include": ["src/**/*", "compile.ts", "tests/**/*"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd curriculum && npm install`

- [ ] **Step 4: Generate Prisma client for curriculum**

Run: `cd curriculum && npx prisma generate --schema=../platform/prisma/schema.prisma`

- [ ] **Step 5: Commit**

```bash
cd curriculum
git init
git add package.json tsconfig.json package-lock.json
git commit -m "chore: scaffold curriculum project"
```

---

## Task 3: Parser — Markdown Splitting and Block Classification

**Files:**
- Create: `curriculum/src/parser.ts`
- Create: `curriculum/tests/parser.test.ts`

- [ ] **Step 1: Write parser tests**

Create `curriculum/tests/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseLessonFile, parseTrackFile, extractCodeFences, parseMultipleChoice } from '../src/parser';

describe('parseTrackFile', () => {
  it('extracts track metadata from frontmatter', () => {
    const content = `---
id: swift-fundamentals
title: Swift Fundamentals
language: swift
kind: fundamentals
description: Learn Swift
lessons:
  - 01-intro
  - 02-functions
---
`;
    const track = parseTrackFile(content);
    expect(track.id).toBe('swift-fundamentals');
    expect(track.title).toBe('Swift Fundamentals');
    expect(track.language).toBe('swift');
    expect(track.kind).toBe('fundamentals');
    expect(track.description).toBe('Learn Swift');
    expect(track.lessons).toEqual(['01-intro', '02-functions']);
  });
});

describe('parseLessonFile', () => {
  it('parses lesson metadata from first block', () => {
    const content = `---
type: lesson
title: Intro
level: beginner
summary: First lesson
---

Some explanation text.
`;
    const lesson = parseLessonFile(content);
    expect(lesson.title).toBe('Intro');
    expect(lesson.level).toBe('beginner');
    expect(lesson.summary).toBe('First lesson');
    expect(lesson.blocks).toHaveLength(1);
    expect(lesson.blocks[0].kind).toBe('explanation');
    expect(lesson.blocks[0].explanationMarkdown).toBe('Some explanation text.');
  });

  it('classifies exercise blocks by type field', () => {
    const content = `---
type: lesson
title: Test
level: beginner
summary: Test
---

Explanation here.

---
type: exercise
kind: code
language: swift
pointsMax: 100
---

Write hello world.

\`\`\`swift:starter
func hello() {}
\`\`\`

\`\`\`swift:test
hello()
\`\`\`
`;
    const lesson = parseLessonFile(content);
    expect(lesson.blocks).toHaveLength(2);
    expect(lesson.blocks[0].kind).toBe('explanation');
    expect(lesson.blocks[1].kind).toBe('exercise');
    expect(lesson.blocks[1].exercise!.type).toBe('code');
    expect(lesson.blocks[1].exercise!.promptMarkdown).toContain('Write hello world.');
  });

  it('handles consecutive exercise blocks with no explanation between', () => {
    const content = `---
type: lesson
title: Test
level: beginner
summary: Test
---

---
type: exercise
kind: multiple_choice
pointsMax: 10
---

Pick one.

- [x] A
- [ ] B

---
type: exercise
kind: code
language: swift
pointsMax: 20
---

Code it.

\`\`\`swift:starter
// code
\`\`\`

\`\`\`swift:test
// test
\`\`\`
`;
    const lesson = parseLessonFile(content);
    expect(lesson.blocks).toHaveLength(2);
    expect(lesson.blocks[0].exercise!.type).toBe('multiple_choice');
    expect(lesson.blocks[1].exercise!.type).toBe('code');
  });
});

describe('extractCodeFences', () => {
  it('extracts tagged code fences', () => {
    const body = `Some text.

\`\`\`swift:starter
func hello() {}
\`\`\`

\`\`\`swift:test
hello()
\`\`\`
`;
    const fences = extractCodeFences(body);
    expect(fences.starter).toBe('func hello() {}');
    expect(fences.test).toBe('hello()');
    expect(fences.language).toBe('swift');
  });

  it('extracts broken code fence for fix_bug', () => {
    const body = `Fix this.

\`\`\`swift:broken
func add(_ a: Int, _ b: Int) -> Int { return a - b }
\`\`\`

\`\`\`swift:test
check(add(2,3) == 5)
\`\`\`
`;
    const fences = extractCodeFences(body);
    expect(fences.broken).toBe('func add(_ a: Int, _ b: Int) -> Int { return a - b }');
    expect(fences.test).toBe('check(add(2,3) == 5)');
  });
});

describe('parseMultipleChoice', () => {
  it('extracts options and correct IDs from checkbox syntax', () => {
    const body = `What is 2+2?

- [x] \`4\`
- [ ] \`5\`
- [ ] \`3\`
`;
    const result = parseMultipleChoice(body);
    expect(result.options).toHaveLength(3);
    expect(result.options[0]).toEqual({ id: 'opt-0', text: '`4`' });
    expect(result.correctOptionIds).toEqual(['opt-0']);
    expect(result.multiSelect).toBe(false);
  });

  it('detects multiSelect when multiple correct answers', () => {
    const body = `Select all that apply.

- [x] A
- [x] B
- [ ] C
`;
    const result = parseMultipleChoice(body);
    expect(result.correctOptionIds).toEqual(['opt-0', 'opt-1']);
    expect(result.multiSelect).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd curriculum && npx vitest run`
Expected: FAIL — module `../src/parser` not found.

- [ ] **Step 3: Implement the parser**

Create `curriculum/src/parser.ts`:

```typescript
import matter from 'gray-matter';

export type TrackMeta = {
  id: string;
  title: string;
  language: 'swift' | 'kotlin';
  kind: 'placement' | 'fundamentals' | 'capstone';
  description: string;
  lessons: string[];
};

export type ExerciseMeta = {
  type: string;
  kind: string;
  language?: string;
  pointsMax: number;
  hints?: string[];
  concepts?: string[];
  testEntryPoint?: string;
  expectedOutput?: string;
  blanks?: Record<string, string[]>;
  promptMarkdown: string;
  codeFences: CodeFences;
  multipleChoice?: MultipleChoiceResult;
};

export type ParsedBlock = {
  kind: 'explanation' | 'exercise';
  explanationMarkdown?: string;
  exercise?: ExerciseMeta;
};

export type ParsedLesson = {
  title: string;
  level: string;
  summary: string;
  blocks: ParsedBlock[];
};

export type CodeFences = {
  language?: string;
  starter?: string;
  test?: string;
  broken?: string;
};

export type MultipleChoiceResult = {
  questionMarkdown: string;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  multiSelect: boolean;
};

export function parseTrackFile(content: string): TrackMeta {
  const { data } = matter(content);
  return {
    id: data.id,
    title: data.title,
    language: data.language,
    kind: data.kind,
    description: data.description,
    lessons: data.lessons ?? [],
  };
}

export function parseLessonFile(content: string): ParsedLesson {
  // Split on --- delimiters. gray-matter only parses the first block,
  // so we split manually.
  const sections = splitFrontmatterSections(content);

  // First section must be lesson metadata
  const first = matter(sections[0]);
  if (first.data.type !== 'lesson') {
    throw new Error(`First block must have type: lesson, got: ${first.data.type}`);
  }

  const lesson: ParsedLesson = {
    title: first.data.title,
    level: first.data.level,
    summary: first.data.summary,
    blocks: [],
  };

  // Remaining sections are explanation or exercise blocks
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const parsed = matter(section);

    if (parsed.data.type === 'exercise') {
      const body = parsed.content.trim();
      const codeFences = extractCodeFences(body);
      const promptMarkdown = stripCodeFences(body);

      const exercise: ExerciseMeta = {
        type: parsed.data.type,
        kind: parsed.data.kind,
        language: parsed.data.language,
        pointsMax: parsed.data.pointsMax ?? 0,
        hints: parsed.data.hints ?? [],
        concepts: parsed.data.concepts ?? [],
        testEntryPoint: parsed.data.testEntryPoint,
        expectedOutput: parsed.data.expectedOutput,
        blanks: parsed.data.blanks,
        promptMarkdown,
        codeFences,
      };

      if (parsed.data.kind === 'multiple_choice') {
        exercise.multipleChoice = parseMultipleChoice(body);
      }

      lesson.blocks.push({ kind: 'exercise', exercise });
    } else {
      // Explanation block — any content without type: exercise
      const text = parsed.content.trim();
      if (text.length > 0) {
        lesson.blocks.push({ kind: 'explanation', explanationMarkdown: text });
      }
    }
  }

  return lesson;
}

export function extractCodeFences(body: string): CodeFences {
  const fenceRegex = /```(\w+):(\w+)\n([\s\S]*?)```/g;
  const result: CodeFences = {};
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(body)) !== null) {
    const [, lang, tag, code] = match;
    result.language = lang;
    if (tag === 'starter') result.starter = code.trim();
    else if (tag === 'test') result.test = code.trim();
    else if (tag === 'broken') result.broken = code.trim();
  }

  return result;
}

export function parseMultipleChoice(body: string): MultipleChoiceResult {
  const lines = body.split('\n');
  const options: Array<{ id: string; text: string }> = [];
  const correctOptionIds: string[] = [];
  const nonOptionLines: string[] = [];

  for (const line of lines) {
    const checkedMatch = line.match(/^-\s+\[x\]\s+(.+)$/);
    const uncheckedMatch = line.match(/^-\s+\[\s*\]\s+(.+)$/);

    if (checkedMatch) {
      const id = `opt-${options.length}`;
      options.push({ id, text: checkedMatch[1].trim() });
      correctOptionIds.push(id);
    } else if (uncheckedMatch) {
      const id = `opt-${options.length}`;
      options.push({ id, text: uncheckedMatch[1].trim() });
    } else {
      nonOptionLines.push(line);
    }
  }

  return {
    questionMarkdown: nonOptionLines.join('\n').trim(),
    options,
    correctOptionIds,
    multiSelect: correctOptionIds.length > 1,
  };
}

function splitFrontmatterSections(content: string): string[] {
  // Split on lines that are exactly '---' (frontmatter delimiters)
  // but handle the first section specially since it starts with ---
  const lines = content.split('\n');
  const sections: string[] = [];
  let current: string[] = [];
  let inFrontmatter = false;
  let sectionStart = true;

  for (const line of lines) {
    if (line.trim() === '---') {
      if (sectionStart) {
        // Opening --- of a frontmatter block
        current.push(line);
        inFrontmatter = true;
        sectionStart = false;
      } else if (inFrontmatter) {
        // Closing --- of a frontmatter block
        current.push(line);
        inFrontmatter = false;
      } else {
        // Section separator — start a new section
        if (current.length > 0) {
          sections.push(current.join('\n'));
        }
        current = [];
        sectionStart = true;
      }
    } else {
      current.push(line);
      sectionStart = false;
    }
  }

  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  return sections;
}

function stripCodeFences(body: string): string {
  // Remove tagged code fences from the body, leaving just the prompt text
  return body
    .replace(/```\w+:\w+\n[\s\S]*?```/g, '')
    .trim();
}
```

- [ ] **Step 4: Run tests**

Run: `cd curriculum && npx vitest run`
Expected: All parser tests pass.

- [ ] **Step 5: Commit**

```bash
cd curriculum
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: add curriculum markdown parser"
```

---

## Task 4: Hasher — Deterministic IDs and Content Hashing

**Files:**
- Create: `curriculum/src/hasher.ts`
- Create: `curriculum/tests/hasher.test.ts`

- [ ] **Step 1: Write hasher tests**

Create `curriculum/tests/hasher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { stableId, contentHash } from '../src/hasher';

describe('stableId', () => {
  it('produces a valid UUID for a track path', () => {
    const id = stableId('track:swift-fundamentals');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is deterministic — same input produces same output', () => {
    const a = stableId('exercise:swift-fundamentals/01-intro/0');
    const b = stableId('exercise:swift-fundamentals/01-intro/0');
    expect(a).toBe(b);
  });

  it('produces different IDs for different paths', () => {
    const a = stableId('exercise:swift-fundamentals/01-intro/0');
    const b = stableId('exercise:swift-fundamentals/01-intro/1');
    expect(a).not.toBe(b);
  });
});

describe('contentHash', () => {
  it('returns a hex string', () => {
    const hash = contentHash({ foo: 'bar' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const a = contentHash({ x: 1, y: 2 });
    const b = contentHash({ x: 1, y: 2 });
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = contentHash({ x: 1 });
    const b = contentHash({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('is order-independent for object keys', () => {
    const a = contentHash({ x: 1, y: 2 });
    const b = contentHash({ y: 2, x: 1 });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd curriculum && npx vitest run`
Expected: FAIL — module `../src/hasher` not found.

- [ ] **Step 3: Implement the hasher**

Create `curriculum/src/hasher.ts`:

```typescript
import { v5 as uuid5 } from 'uuid';
import { createHash } from 'crypto';

// Fixed namespace UUID for BootCamp curriculum
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function stableId(path: string): string {
  return uuid5(path, NAMESPACE);
}

export function contentHash(content: Record<string, unknown>): string {
  const sorted = JSON.stringify(content, Object.keys(content).sort());
  return createHash('sha256').update(sorted).digest('hex');
}
```

- [ ] **Step 4: Run tests**

Run: `cd curriculum && npx vitest run`
Expected: All hasher tests pass.

- [ ] **Step 5: Commit**

```bash
cd curriculum
git add src/hasher.ts tests/hasher.test.ts
git commit -m "feat: add deterministic ID and content hash utilities"
```

---

## Task 5: Validator — Build Exercise Payloads from Parsed Blocks

**Files:**
- Create: `curriculum/src/validator.ts`
- Create: `curriculum/tests/validator.test.ts`

- [ ] **Step 1: Write validator tests**

Create `curriculum/tests/validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildExercisePayload, type ValidationError } from '../src/validator';
import type { ExerciseMeta } from '../src/parser';

function makeExercise(overrides: Partial<ExerciseMeta>): ExerciseMeta {
  return {
    type: 'exercise',
    kind: 'code',
    language: 'swift',
    pointsMax: 100,
    hints: [],
    concepts: [],
    promptMarkdown: 'Write code.',
    codeFences: {},
    ...overrides,
  };
}

describe('buildExercisePayload', () => {
  it('builds a code payload', () => {
    const ex = makeExercise({
      kind: 'code',
      language: 'swift',
      codeFences: { language: 'swift', starter: 'func f() {}', test: 'f()' },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload).toEqual({
      type: 'code',
      language: 'swift',
      starterCode: 'func f() {}',
      testCode: 'f()',
      testEntryPoint: 'Tests',
    });
    expect(result.errors).toHaveLength(0);
  });

  it('builds a fix_bug payload', () => {
    const ex = makeExercise({
      kind: 'fix_bug',
      language: 'swift',
      codeFences: { language: 'swift', broken: 'func f() { bad }', test: 'f()' },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload).toEqual({
      type: 'fix_bug',
      language: 'swift',
      brokenCode: 'func f() { bad }',
      testCode: 'f()',
      testEntryPoint: 'Tests',
    });
    expect(result.errors).toHaveLength(0);
  });

  it('builds a fill_blank payload', () => {
    const ex = makeExercise({
      kind: 'fill_blank',
      language: 'swift',
      blanks: { '1': ['let'], '2': ['String'] },
      codeFences: { language: 'swift', starter: '___1 x: ___2 = ""' },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload).toEqual({
      type: 'fill_blank',
      language: 'swift',
      template: '___1 x: ___2 = ""',
      blanks: [
        { id: '1', expected: ['let'] },
        { id: '2', expected: ['String'] },
      ],
    });
    expect(result.errors).toHaveLength(0);
  });

  it('builds a predict_output payload', () => {
    const ex = makeExercise({
      kind: 'predict_output',
      language: 'swift',
      expectedOutput: '42',
      codeFences: { language: 'swift', starter: 'print(42)' },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload).toEqual({
      type: 'predict_output',
      displayedCode: 'print(42)',
      displayedLanguage: 'swift',
      expectedOutput: '42',
    });
    expect(result.errors).toHaveLength(0);
  });

  it('builds a multiple_choice payload', () => {
    const ex = makeExercise({
      kind: 'multiple_choice',
      multipleChoice: {
        questionMarkdown: 'Pick one.',
        options: [
          { id: 'opt-0', text: 'A' },
          { id: 'opt-1', text: 'B' },
        ],
        correctOptionIds: ['opt-0'],
        multiSelect: false,
      },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload).toEqual({
      type: 'multiple_choice',
      questionMarkdown: 'Pick one.',
      options: [
        { id: 'opt-0', text: 'A' },
        { id: 'opt-1', text: 'B' },
      ],
      correctOptionIds: ['opt-0'],
      multiSelect: false,
    });
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing code fences', () => {
    const ex = makeExercise({
      kind: 'code',
      language: 'swift',
      codeFences: {},
    });
    const result = buildExercisePayload(ex);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('starter');
  });

  it('uses custom testEntryPoint from frontmatter', () => {
    const ex = makeExercise({
      kind: 'code',
      language: 'swift',
      testEntryPoint: 'CustomTests',
      codeFences: { language: 'swift', starter: 'func f() {}', test: 'f()' },
    });
    const result = buildExercisePayload(ex);
    expect(result.payload!.type).toBe('code');
    expect((result.payload as any).testEntryPoint).toBe('CustomTests');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd curriculum && npx vitest run`
Expected: FAIL — module `../src/validator` not found.

- [ ] **Step 3: Implement the validator**

Create `curriculum/src/validator.ts`:

```typescript
import type { ExerciseMeta } from './parser';

export type ValidationError = {
  message: string;
};

export type PayloadResult = {
  payload: Record<string, unknown> | null;
  errors: ValidationError[];
};

const DEFAULT_TEST_ENTRY: Record<string, string> = {
  swift: 'Tests',
  kotlin: 'TestKt',
};

export function buildExercisePayload(exercise: ExerciseMeta): PayloadResult {
  const errors: ValidationError[] = [];

  switch (exercise.kind) {
    case 'code': {
      if (!exercise.codeFences.starter) errors.push({ message: 'code exercise missing starter code fence' });
      if (!exercise.codeFences.test) errors.push({ message: 'code exercise missing test code fence' });
      if (errors.length > 0) return { payload: null, errors };
      const lang = exercise.language ?? exercise.codeFences.language ?? 'swift';
      return {
        payload: {
          type: 'code',
          language: lang,
          starterCode: exercise.codeFences.starter!,
          testCode: exercise.codeFences.test!,
          testEntryPoint: exercise.testEntryPoint ?? DEFAULT_TEST_ENTRY[lang] ?? 'Tests',
        },
        errors: [],
      };
    }

    case 'fix_bug': {
      if (!exercise.codeFences.broken) errors.push({ message: 'fix_bug exercise missing broken code fence' });
      if (!exercise.codeFences.test) errors.push({ message: 'fix_bug exercise missing test code fence' });
      if (errors.length > 0) return { payload: null, errors };
      const lang = exercise.language ?? exercise.codeFences.language ?? 'swift';
      return {
        payload: {
          type: 'fix_bug',
          language: lang,
          brokenCode: exercise.codeFences.broken!,
          testCode: exercise.codeFences.test!,
          testEntryPoint: exercise.testEntryPoint ?? DEFAULT_TEST_ENTRY[lang] ?? 'Tests',
        },
        errors: [],
      };
    }

    case 'fill_blank': {
      if (!exercise.codeFences.starter) errors.push({ message: 'fill_blank exercise missing starter code fence' });
      if (!exercise.blanks) errors.push({ message: 'fill_blank exercise missing blanks in frontmatter' });
      if (errors.length > 0) return { payload: null, errors };
      const lang = exercise.language ?? exercise.codeFences.language ?? 'swift';
      const blanks = Object.entries(exercise.blanks!).map(([id, expected]) => ({
        id,
        expected: Array.isArray(expected) ? expected : [expected],
      }));
      return {
        payload: {
          type: 'fill_blank',
          language: lang,
          template: exercise.codeFences.starter!,
          blanks,
        },
        errors: [],
      };
    }

    case 'predict_output': {
      if (!exercise.codeFences.starter) errors.push({ message: 'predict_output exercise missing starter code fence' });
      if (!exercise.expectedOutput) errors.push({ message: 'predict_output exercise missing expectedOutput in frontmatter' });
      if (errors.length > 0) return { payload: null, errors };
      const lang = exercise.language ?? exercise.codeFences.language ?? 'swift';
      return {
        payload: {
          type: 'predict_output',
          displayedCode: exercise.codeFences.starter!,
          displayedLanguage: lang,
          expectedOutput: exercise.expectedOutput!,
        },
        errors: [],
      };
    }

    case 'multiple_choice': {
      if (!exercise.multipleChoice) errors.push({ message: 'multiple_choice exercise has no options' });
      if (errors.length > 0) return { payload: null, errors };
      return {
        payload: {
          type: 'multiple_choice',
          questionMarkdown: exercise.multipleChoice!.questionMarkdown,
          options: exercise.multipleChoice!.options,
          correctOptionIds: exercise.multipleChoice!.correctOptionIds,
          multiSelect: exercise.multipleChoice!.multiSelect,
        },
        errors: [],
      };
    }

    default:
      return { payload: null, errors: [{ message: `Unknown exercise kind: ${exercise.kind}` }] };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd curriculum && npx vitest run`
Expected: All validator tests pass.

- [ ] **Step 5: Commit**

```bash
cd curriculum
git add src/validator.ts tests/validator.test.ts
git commit -m "feat: add exercise payload builder with validation"
```

---

## Task 6: Compiler — Core Pipeline

**Files:**
- Create: `curriculum/src/compiler.ts`
- Create: `curriculum/src/publisher.ts`

- [ ] **Step 1: Write the publisher**

Create `curriculum/src/publisher.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export async function publishTrack(
  prisma: PrismaClient,
  trackId: string,
  version: number,
  lessonVersions: Array<{ id: string; version: number }>,
  exerciseVersions: Array<{ id: string; version: number }>,
): Promise<void> {
  // Publish bottom-up: exercises → lessons → track
  for (const ex of exerciseVersions) {
    const existing = await prisma.exercise.findFirst({
      where: { id: ex.id, version: ex.version },
    });
    if (existing && !existing.publishedAt) {
      await prisma.exercise.update({
        where: { id_version: { id: ex.id, version: ex.version } },
        data: { publishedAt: new Date() },
      });
    }
  }

  for (const lesson of lessonVersions) {
    const existing = await prisma.lesson.findFirst({
      where: { id: lesson.id, version: lesson.version },
    });
    if (existing && !existing.publishedAt) {
      await prisma.lesson.update({
        where: { id_version: { id: lesson.id, version: lesson.version } },
        data: { publishedAt: new Date() },
      });
    }
  }

  const track = await prisma.track.findFirst({
    where: { id: trackId, version },
  });
  if (track && !track.publishedAt) {
    await prisma.track.update({
      where: { id_version: { id: trackId, version } },
      data: { publishedAt: new Date() },
    });
  }
}
```

- [ ] **Step 2: Write the compiler**

Create `curriculum/src/compiler.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync, readdirSync as fsReaddirSync } from 'fs';
import { join, resolve } from 'path';
import { parseTrackFile, parseLessonFile, type ParsedBlock } from './parser';
import { buildExercisePayload } from './validator';
import { stableId, contentHash } from './hasher';
import { publishTrack } from './publisher';

export type CompileResult = {
  tracksCompiled: number;
  lessonsCompiled: number;
  exercisesCompiled: number;
  skipped: number;
  errors: string[];
};

export async function compileAll(
  curriculumDir: string,
  options: { publish: boolean },
): Promise<CompileResult> {
  const prisma = new PrismaClient();
  const result: CompileResult = {
    tracksCompiled: 0,
    lessonsCompiled: 0,
    exercisesCompiled: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Discovery: find all track.md files
    const trackDirs: string[] = [];
    const entries = readdirSync(curriculumDir);
    for (const entry of entries) {
      const trackPath = join(curriculumDir, entry, 'track.md');
      if (existsSync(trackPath)) {
        trackDirs.push(entry);
      }
    }

    for (const trackSlug of trackDirs) {
      const trackResult = await compileTrack(prisma, curriculumDir, trackSlug, options);
      result.tracksCompiled += trackResult.tracksCompiled;
      result.lessonsCompiled += trackResult.lessonsCompiled;
      result.exercisesCompiled += trackResult.exercisesCompiled;
      result.skipped += trackResult.skipped;
      result.errors.push(...trackResult.errors);
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

export async function compileTrack(
  prisma: PrismaClient,
  curriculumDir: string,
  trackSlug: string,
  options: { publish: boolean },
): Promise<CompileResult> {
  const result: CompileResult = {
    tracksCompiled: 0,
    lessonsCompiled: 0,
    exercisesCompiled: 0,
    skipped: 0,
    errors: [],
  };

  // Parse track.md
  const trackPath = join(curriculumDir, trackSlug, 'track.md');
  const trackContent = readFileSync(trackPath, 'utf-8');
  const trackMeta = parseTrackFile(trackContent);

  const trackId = stableId(`track:${trackSlug}`);
  const lessonIds: string[] = [];
  const lessonVersions: number[] = [];
  const allExerciseVersions: Array<{ id: string; version: number }> = [];
  const allLessonVersions: Array<{ id: string; version: number }> = [];

  // Validate all lessons first (fail-fast)
  const parsedLessons: Array<{
    slug: string;
    lesson: ReturnType<typeof parseLessonFile>;
  }> = [];

  for (const lessonSlug of trackMeta.lessons) {
    const lessonPath = join(curriculumDir, trackSlug, `${lessonSlug}.md`);
    if (!existsSync(lessonPath)) {
      result.errors.push(`${trackSlug}/${lessonSlug}.md: file not found`);
      continue;
    }
    const lessonContent = readFileSync(lessonPath, 'utf-8');
    const lesson = parseLessonFile(lessonContent);

    // Validate all exercise payloads
    let lessonHasErrors = false;
    for (let i = 0; i < lesson.blocks.length; i++) {
      const block = lesson.blocks[i];
      if (block.kind === 'exercise' && block.exercise) {
        const payloadResult = buildExercisePayload(block.exercise);
        if (payloadResult.errors.length > 0) {
          for (const err of payloadResult.errors) {
            result.errors.push(`${trackSlug}/${lessonSlug}.md block ${i}: ${err.message}`);
          }
          lessonHasErrors = true;
        }
      }
    }

    if (!lessonHasErrors) {
      parsedLessons.push({ slug: lessonSlug, lesson });
    }
  }

  // If any validation errors, bail without writing
  if (result.errors.length > 0) {
    return result;
  }

  // Write lessons and exercises
  for (let lessonIdx = 0; lessonIdx < parsedLessons.length; lessonIdx++) {
    const { slug: lessonSlug, lesson } = parsedLessons[lessonIdx];
    const lessonId = stableId(`lesson:${trackSlug}/${lessonSlug}`);
    const blockIds: string[] = [];
    const blockInputs: Array<{
      id: string;
      position: number;
      kind: string;
      explanationMarkdown: string | null;
      exerciseId: string | null;
      exerciseVersion: number | null;
    }> = [];

    let exerciseIndex = 0;
    for (let blockIdx = 0; blockIdx < lesson.blocks.length; blockIdx++) {
      const block = lesson.blocks[blockIdx];
      const blockId = stableId(`block:${trackSlug}/${lessonSlug}/${blockIdx}`);
      blockIds.push(blockId);

      if (block.kind === 'explanation') {
        blockInputs.push({
          id: blockId,
          position: blockIdx,
          kind: 'explanation',
          explanationMarkdown: block.explanationMarkdown ?? null,
          exerciseId: null,
          exerciseVersion: null,
        });
      } else if (block.kind === 'exercise' && block.exercise) {
        const exerciseId = stableId(`exercise:${trackSlug}/${lessonSlug}/${exerciseIndex}`);
        const payloadResult = buildExercisePayload(block.exercise);
        const payload = payloadResult.payload!;

        // Compute content hash
        const exHash = contentHash({
          promptMarkdown: block.exercise.promptMarkdown,
          payload,
          hints: block.exercise.hints ?? [],
          concepts: block.exercise.concepts ?? [],
          pointsMax: block.exercise.pointsMax,
        });

        // Check existing version
        const existing = await prisma.exercise.findFirst({
          where: { id: exerciseId },
          orderBy: { version: 'desc' },
        });

        let exVersion: number;
        if (!existing) {
          await prisma.exercise.create({
            data: {
              id: exerciseId,
              version: 1,
              lessonId,
              promptMarkdown: block.exercise.promptMarkdown,
              type: block.exercise.kind,
              payload: payload as any,
              pointsMax: block.exercise.pointsMax,
              hints: block.exercise.hints ?? [],
              concepts: block.exercise.concepts ?? [],
              contentHash: exHash,
            },
          });
          exVersion = 1;
          result.exercisesCompiled++;
        } else if (existing.contentHash !== exHash) {
          exVersion = existing.version + 1;
          await prisma.exercise.create({
            data: {
              id: exerciseId,
              version: exVersion,
              lessonId,
              promptMarkdown: block.exercise.promptMarkdown,
              type: block.exercise.kind,
              payload: payload as any,
              pointsMax: block.exercise.pointsMax,
              hints: block.exercise.hints ?? [],
              concepts: block.exercise.concepts ?? [],
              contentHash: exHash,
            },
          });
          result.exercisesCompiled++;
        } else {
          exVersion = existing.version;
          result.skipped++;
        }

        allExerciseVersions.push({ id: exerciseId, version: exVersion });
        blockInputs.push({
          id: blockId,
          position: blockIdx,
          kind: 'exercise',
          explanationMarkdown: null,
          exerciseId,
          exerciseVersion: exVersion,
        });
        exerciseIndex++;
      }
    }

    // Compute lesson hash
    const lessonHash = contentHash({
      title: lesson.title,
      level: lesson.level,
      summary: lesson.summary,
      blockIds,
    });

    const existingLesson = await prisma.lesson.findFirst({
      where: { id: lessonId },
      orderBy: { version: 'desc' },
    });

    let lVersion: number;
    if (!existingLesson) {
      lVersion = 1;
    } else if (existingLesson.contentHash !== lessonHash) {
      lVersion = existingLesson.version + 1;
    } else {
      lVersion = existingLesson.version;
      lessonIds.push(lessonId);
      lessonVersions.push(lVersion);
      allLessonVersions.push({ id: lessonId, version: lVersion });
      result.skipped++;
      continue;
    }

    // Create lesson + blocks in transaction
    await prisma.$transaction(async (tx) => {
      await tx.lesson.create({
        data: {
          id: lessonId,
          version: lVersion,
          trackId,
          position: lessonIdx,
          title: lesson.title,
          level: lesson.level as any,
          summary: lesson.summary,
          blockIds,
          contentHash: lessonHash,
        },
      });
      await tx.block.createMany({
        data: blockInputs.map((b) => ({
          id: b.id,
          lessonId,
          lessonVersion: lVersion,
          position: b.position,
          kind: b.kind as any,
          explanationMarkdown: b.explanationMarkdown,
          exerciseId: b.exerciseId,
          exerciseVersion: b.exerciseVersion,
        })),
      });
    });

    lessonIds.push(lessonId);
    lessonVersions.push(lVersion);
    allLessonVersions.push({ id: lessonId, version: lVersion });
    result.lessonsCompiled++;
  }

  // Compile track
  const trackHash = contentHash({
    title: trackMeta.title,
    language: trackMeta.language,
    kind: trackMeta.kind,
    description: trackMeta.description,
    lessonIds,
  });

  const existingTrack = await prisma.track.findFirst({
    where: { id: trackId },
    orderBy: { version: 'desc' },
  });

  let trackVersion: number;
  if (!existingTrack) {
    trackVersion = 1;
  } else if (existingTrack.contentHash !== trackHash) {
    trackVersion = existingTrack.version + 1;
  } else {
    result.skipped++;
    if (options.publish) {
      await publishTrack(prisma, trackId, existingTrack.version, allLessonVersions, allExerciseVersions);
    }
    return result;
  }

  await prisma.track.create({
    data: {
      id: trackId,
      version: trackVersion,
      title: trackMeta.title,
      language: trackMeta.language as any,
      kind: trackMeta.kind as any,
      description: trackMeta.description,
      lessonIds,
      lessonVersions,
      contentHash: trackHash,
    },
  });
  result.tracksCompiled++;

  if (options.publish) {
    await publishTrack(prisma, trackId, trackVersion, allLessonVersions, allExerciseVersions);
  }

  return result;
}

function readdirSync(dir: string): string[] {
  return fsReaddirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
```

- [ ] **Step 2: Commit**

```bash
cd curriculum
git add src/compiler.ts src/publisher.ts
git commit -m "feat: add curriculum compiler pipeline and publisher"
```

---

## Task 7: CLI Entry Point

**Files:**
- Create: `curriculum/compile.ts`

- [ ] **Step 1: Write the CLI entry point**

Create `curriculum/compile.ts`:

```typescript
import { resolve } from 'path';
import { compileAll, compileTrack } from './src/compiler';
import { PrismaClient } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const publish = args.includes('--publish');
  const trackFilter = args.find((a) => !a.startsWith('--'));

  const curriculumDir = resolve(__dirname);

  console.log(`Compiling curriculum from ${curriculumDir}`);
  if (publish) console.log('Publishing enabled');
  if (trackFilter) console.log(`Filtering to track: ${trackFilter}`);

  let result;
  if (trackFilter) {
    const prisma = new PrismaClient();
    try {
      result = await compileTrack(prisma, curriculumDir, trackFilter, { publish });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    result = await compileAll(curriculumDir, { publish });
  }

  if (result.errors.length > 0) {
    console.error('\nValidation errors:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\nCompilation complete:');
  console.log(`  Tracks:    ${result.tracksCompiled} compiled`);
  console.log(`  Lessons:   ${result.lessonsCompiled} compiled`);
  console.log(`  Exercises: ${result.exercisesCompiled} compiled`);
  console.log(`  Skipped:   ${result.skipped} (unchanged)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
cd curriculum
git add compile.ts
git commit -m "feat: add CLI entry point for curriculum compiler"
```

---

## Task 8: Sample Curriculum

**Files:**
- Create: `curriculum/swift-fundamentals/track.md`
- Create: `curriculum/swift-fundamentals/01-intro.md`
- Create: `curriculum/swift-fundamentals/02-functions.md`

- [ ] **Step 1: Write sample track**

Create `curriculum/swift-fundamentals/track.md`:

```markdown
---
id: swift-fundamentals
title: Swift Fundamentals
language: swift
kind: fundamentals
description: A complete introduction to Swift for experienced programmers.
lessons:
  - 01-intro
  - 02-functions
---
```

- [ ] **Step 2: Write lesson 1 — covering all 5 exercise types**

Create `curriculum/swift-fundamentals/01-intro.md`:

```markdown
---
type: lesson
title: Introduction to Swift
level: beginner
summary: Your first taste of every exercise type.
---

# Welcome to Swift

Swift is a modern, safe programming language created by Apple. If you're coming from another language, you'll find Swift familiar but with some unique features.

---
type: exercise
kind: multiple_choice
pointsMax: 10
concepts:
  - languages
---

Which of the following are valid Swift keywords?

- [x] `let`
- [x] `var`
- [ ] `const`
- [ ] `dim`

---

## Variables and Constants

In Swift, `let` declares a constant and `var` declares a variable. Swift is type-safe with type inference.

---
type: exercise
kind: fill_blank
language: swift
pointsMax: 10
hints:
  - Use the keyword for a constant
blanks:
  "1": ["let"]
concepts:
  - variables
---

Fill in the blank to declare a constant.

```swift:starter
___1 greeting = "Hello"
```

---
type: exercise
kind: predict_output
language: swift
pointsMax: 10
expectedOutput: "5"
concepts:
  - arithmetic
---

What does this code print?

```swift:starter
let a = 2
let b = 3
print(a + b)
```

---
type: exercise
kind: code
language: swift
pointsMax: 20
hints:
  - Return a string literal
concepts:
  - functions
  - strings
---

Write a `greet` function that returns `"Hello, Swift!"`.

```swift:starter
func greet() -> String {
    // your code here
    return ""
}
```

```swift:test
bootcampAssertEqual(greet(), "Hello, Swift!", "greet() should return Hello, Swift!")
```

---
type: exercise
kind: fix_bug
language: swift
pointsMax: 15
hints:
  - Check the operator
concepts:
  - functions
  - arithmetic
---

Fix the bug in this `add` function.

```swift:broken
func add(_ a: Int, _ b: Int) -> Int {
    return a - b
}
```

```swift:test
bootcampAssertEqual(add(2, 3), 5, "add(2, 3) should return 5")
```
```

- [ ] **Step 3: Write lesson 2**

Create `curriculum/swift-fundamentals/02-functions.md`:

```markdown
---
type: lesson
title: Functions in Swift
level: beginner
summary: Learn to define and call functions.
---

# Functions

Functions are self-contained chunks of code that perform a specific task. You define a function with the `func` keyword.

---
type: exercise
kind: code
language: swift
pointsMax: 20
hints:
  - Use the * operator
concepts:
  - functions
  - arithmetic
---

Write a `multiply` function that takes two integers and returns their product.

```swift:starter
func multiply(_ a: Int, _ b: Int) -> Int {
    // your code here
    return 0
}
```

```swift:test
bootcampAssertEqual(multiply(3, 4), 12, "multiply(3, 4) should return 12")
bootcampAssertEqual(multiply(0, 5), 0, "multiply(0, 5) should return 0")
```

---
type: exercise
kind: code
language: swift
pointsMax: 25
hints:
  - Use an if statement
  - Return a Bool
concepts:
  - functions
  - conditionals
---

Write an `isEven` function that returns `true` if the number is even.

```swift:starter
func isEven(_ n: Int) -> Bool {
    // your code here
    return false
}
```

```swift:test
bootcampAssertEqual(isEven(4), true, "isEven(4) should be true")
bootcampAssertEqual(isEven(3), false, "isEven(3) should be false")
```
```

- [ ] **Step 4: Commit**

```bash
cd curriculum
git add swift-fundamentals/
git commit -m "feat: add sample Swift Fundamentals curriculum"
```

---

## Task 9: Integration Tests

**Files:**
- Create: `curriculum/tests/compiler.test.ts`

- [ ] **Step 1: Write integration tests**

Create `curriculum/tests/compiler.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { compileTrack } from '../src/compiler';
import { stableId } from '../src/hasher';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const prisma = new PrismaClient();

function makeTempCurriculum(): string {
  const dir = join(tmpdir(), `bootcamp-test-${Date.now()}`);
  mkdirSync(join(dir, 'test-track'), { recursive: true });
  return dir;
}

function writeTrack(dir: string, slug: string, lessons: string[]) {
  writeFileSync(
    join(dir, slug, 'track.md'),
    `---
id: ${slug}
title: Test Track
language: swift
kind: fundamentals
description: A test track
lessons:
${lessons.map((l) => `  - ${l}`).join('\n')}
---
`,
  );
}

function writeLesson(dir: string, trackSlug: string, lessonSlug: string, body: string) {
  writeFileSync(join(dir, trackSlug, `${lessonSlug}.md`), body);
}

const SIMPLE_LESSON = `---
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

Write hello.

\`\`\`swift:starter
func hello() -> String { return "" }
\`\`\`

\`\`\`swift:test
bootcampAssertEqual(hello(), "hi", "test")
\`\`\`
`;

async function cleanupCompiled(trackSlug: string) {
  const trackId = stableId(`track:${trackSlug}`);
  const lessonId = stableId(`lesson:${trackSlug}/lesson-1`);
  const exerciseId = stableId(`exercise:${trackSlug}/lesson-1/0`);
  const blockIds = [
    stableId(`block:${trackSlug}/lesson-1/0`),
    stableId(`block:${trackSlug}/lesson-1/1`),
  ];

  await prisma.block.deleteMany({ where: { id: { in: blockIds } } });
  await prisma.exercise.deleteMany({ where: { id: exerciseId } });
  await prisma.lesson.deleteMany({ where: { id: lessonId } });
  await prisma.track.deleteMany({ where: { id: trackId } });
}

describe('compiler integration', () => {
  const trackSlug = 'test-track';

  beforeEach(async () => {
    await cleanupCompiled(trackSlug);
  });

  it('compiles a simple track with one lesson', async () => {
    const dir = makeTempCurriculum();
    writeTrack(dir, trackSlug, ['lesson-1']);
    writeLesson(dir, trackSlug, 'lesson-1', SIMPLE_LESSON);

    const result = await compileTrack(prisma, dir, trackSlug, { publish: false });

    expect(result.errors).toHaveLength(0);
    expect(result.tracksCompiled).toBe(1);
    expect(result.lessonsCompiled).toBe(1);
    expect(result.exercisesCompiled).toBe(1);

    // Verify in DB
    const trackId = stableId(`track:${trackSlug}`);
    const track = await prisma.track.findFirst({ where: { id: trackId } });
    expect(track).not.toBeNull();
    expect(track!.title).toBe('Test Track');
    expect(track!.publishedAt).toBeNull(); // draft

    rmSync(dir, { recursive: true });
  });

  it('is idempotent — second compile skips unchanged content', async () => {
    const dir = makeTempCurriculum();
    writeTrack(dir, trackSlug, ['lesson-1']);
    writeLesson(dir, trackSlug, 'lesson-1', SIMPLE_LESSON);

    await compileTrack(prisma, dir, trackSlug, { publish: false });
    const result = await compileTrack(prisma, dir, trackSlug, { publish: false });

    expect(result.tracksCompiled).toBe(0);
    expect(result.lessonsCompiled).toBe(0);
    expect(result.exercisesCompiled).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);

    rmSync(dir, { recursive: true });
  });

  it('creates new version when content changes', async () => {
    const dir = makeTempCurriculum();
    writeTrack(dir, trackSlug, ['lesson-1']);
    writeLesson(dir, trackSlug, 'lesson-1', SIMPLE_LESSON);

    await compileTrack(prisma, dir, trackSlug, { publish: false });

    // Change the exercise prompt
    const modified = SIMPLE_LESSON.replace('Write hello.', 'Write hello world.');
    writeLesson(dir, trackSlug, 'lesson-1', modified);

    const result = await compileTrack(prisma, dir, trackSlug, { publish: false });
    expect(result.exercisesCompiled).toBe(1);

    // Verify version 2 exists
    const exerciseId = stableId(`exercise:${trackSlug}/lesson-1/0`);
    const exercises = await prisma.exercise.findMany({
      where: { id: exerciseId },
      orderBy: { version: 'desc' },
    });
    expect(exercises).toHaveLength(2);
    expect(exercises[0].version).toBe(2);

    rmSync(dir, { recursive: true });
  });

  it('publishes when --publish flag is set', async () => {
    const dir = makeTempCurriculum();
    writeTrack(dir, trackSlug, ['lesson-1']);
    writeLesson(dir, trackSlug, 'lesson-1', SIMPLE_LESSON);

    await compileTrack(prisma, dir, trackSlug, { publish: true });

    const trackId = stableId(`track:${trackSlug}`);
    const track = await prisma.track.findFirst({ where: { id: trackId } });
    expect(track!.publishedAt).not.toBeNull();

    rmSync(dir, { recursive: true });
  });

  it('rejects invalid payloads without writing to DB', async () => {
    const dir = makeTempCurriculum();
    writeTrack(dir, trackSlug, ['lesson-1']);
    // Exercise missing code fences
    writeLesson(dir, trackSlug, 'lesson-1', `---
type: lesson
title: Bad
level: beginner
summary: Bad
---

---
type: exercise
kind: code
language: swift
pointsMax: 100
---

Missing code fences.
`);

    const result = await compileTrack(prisma, dir, trackSlug, { publish: false });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.tracksCompiled).toBe(0);

    // Verify nothing in DB
    const trackId = stableId(`track:${trackSlug}`);
    const track = await prisma.track.findFirst({ where: { id: trackId } });
    expect(track).toBeNull();

    rmSync(dir, { recursive: true });
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd curriculum && npx vitest run`
Expected: All tests pass (requires platform DB running on port 5433).

- [ ] **Step 3: Commit**

```bash
cd curriculum
git add tests/compiler.test.ts
git commit -m "test: add compiler integration tests"
```

---

## Task 10: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all curriculum tests**

Run: `cd curriculum && npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run platform tests (verify schema change didn't break anything)**

Run: `cd platform && npm test`
Expected: All 187 tests pass.

- [ ] **Step 3: Compile the sample curriculum**

Run: `cd curriculum && npx tsx compile.ts`
Expected: Output shows tracks/lessons/exercises compiled, no errors.

- [ ] **Step 4: Compile again — verify idempotency**

Run: `cd curriculum && npx tsx compile.ts`
Expected: Output shows all items skipped (unchanged).

- [ ] **Step 5: Compile with publish**

Run: `cd curriculum && npx tsx compile.ts --publish`
Expected: Output shows compilation + publishing.

- [ ] **Step 6: Verify the compiled content works in the web app**

Start both servers and visit http://localhost:3001. The compiled lessons should be accessible via the lesson page.
