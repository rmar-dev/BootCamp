import { describe, it, expect } from 'vitest';
import {
  parseTrackFile,
  parseLessonFile,
  extractCodeFences,
  parseMultipleChoice,
} from '../src/parser.js';

// ── parseTrackFile ────────────────────────────────────────────────────────────

describe('parseTrackFile', () => {
  const TRACK_CONTENT = `---
id: swift-fundamentals
title: Swift Fundamentals
language: swift
kind: fundamentals
description: Core Swift language concepts for experienced programmers.
lessons:
  - 01-optionals
  - 02-closures
  - 03-protocols
---
`;

  it('extracts id', () => {
    expect(parseTrackFile(TRACK_CONTENT).id).toBe('swift-fundamentals');
  });

  it('extracts title', () => {
    expect(parseTrackFile(TRACK_CONTENT).title).toBe('Swift Fundamentals');
  });

  it('extracts language', () => {
    expect(parseTrackFile(TRACK_CONTENT).language).toBe('swift');
  });

  it('extracts kind', () => {
    expect(parseTrackFile(TRACK_CONTENT).kind).toBe('fundamentals');
  });

  it('extracts description', () => {
    expect(parseTrackFile(TRACK_CONTENT).description).toBe(
      'Core Swift language concepts for experienced programmers.'
    );
  });

  it('extracts lessons array', () => {
    expect(parseTrackFile(TRACK_CONTENT).lessons).toEqual([
      '01-optionals',
      '02-closures',
      '03-protocols',
    ]);
  });

  it('handles kotlin language', () => {
    const content = `---
id: kotlin-track
title: Kotlin Track
language: kotlin
kind: capstone
description: Kotlin capstone.
lessons: []
---
`;
    expect(parseTrackFile(content).language).toBe('kotlin');
    expect(parseTrackFile(content).kind).toBe('capstone');
  });
});

// ── parseLessonFile – metadata ────────────────────────────────────────────────

describe('parseLessonFile – lesson metadata', () => {
  const LESSON = `---
type: lesson
title: Optionals in Swift
level: intermediate
summary: Learn how Swift represents the absence of a value.
---
Optionals let you express that a value might be missing.
---
type: exercise
kind: code-write
language: swift
pointsMax: 10
---
Write a function that unwraps an optional safely.
`;

  it('extracts title', () => {
    expect(parseLessonFile(LESSON).title).toBe('Optionals in Swift');
  });

  it('extracts level', () => {
    expect(parseLessonFile(LESSON).level).toBe('intermediate');
  });

  it('extracts summary from frontmatter', () => {
    expect(parseLessonFile(LESSON).summary).toBe(
      'Learn how Swift represents the absence of a value.'
    );
  });

  it('produces correct number of blocks', () => {
    expect(parseLessonFile(LESSON).blocks).toHaveLength(2);
  });
});

// ── parseLessonFile – block classification ────────────────────────────────────

describe('parseLessonFile – block classification', () => {
  const LESSON = `---
type: lesson
title: Closures
level: advanced
summary: Closures are self-contained blocks of functionality.
---
A closure can capture values from the surrounding scope.

This makes them very powerful.
---
type: exercise
kind: multiple-choice
language: swift
pointsMax: 5
---
Which keyword captures a value by reference in a Swift closure?

- [x] capture list with \`unowned\`
- [ ] \`ref\`
- [ ] \`inout\`
---
type: exercise
kind: code-fix
language: swift
pointsMax: 8
hints:
  - Check the capture list
---
Fix the retain cycle in the code below.
`;

  it('first block is explanation', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[0].kind).toBe('explanation');
  });

  it('explanation block contains markdown', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[0].explanationMarkdown).toContain('capture values');
  });

  it('second block is exercise', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[1].kind).toBe('exercise');
  });

  it('exercise block has correct kind', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[1].exercise?.kind).toBe('multiple-choice');
  });

  it('exercise block has pointsMax', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[1].exercise?.pointsMax).toBe(5);
  });

  it('third block is exercise', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[2].kind).toBe('exercise');
    expect(blocks[2].exercise?.kind).toBe('code-fix');
  });

  it('exercise block has hints', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[2].exercise?.hints).toEqual(['Check the capture list']);
  });

  it('multiple-choice exercise has multipleChoice attached', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks[1].exercise?.multipleChoice).toBeDefined();
  });
});

// ── parseLessonFile – consecutive exercises, no explanation ───────────────────

describe('parseLessonFile – consecutive exercises with no explanation', () => {
  const LESSON = `---
type: lesson
title: Quick Drills
level: beginner
summary: Back-to-back exercises.
---
type: exercise
kind: code-write
language: kotlin
pointsMax: 3
---
First exercise prompt.
---
type: exercise
kind: code-write
language: kotlin
pointsMax: 3
---
Second exercise prompt.
`;

  it('produces two exercise blocks', () => {
    const { blocks } = parseLessonFile(LESSON);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('exercise');
    expect(blocks[1].kind).toBe('exercise');
  });

  it('no explanation blocks present', () => {
    const { blocks } = parseLessonFile(LESSON);
    const explanations = blocks.filter((b) => b.kind === 'explanation');
    expect(explanations).toHaveLength(0);
  });
});

// ── extractCodeFences ─────────────────────────────────────────────────────────

describe('extractCodeFences', () => {
  const BODY = `
Implement the function below.

\`\`\`swift:starter
func greet(_ name: String) -> String {
    // TODO
}
\`\`\`

\`\`\`swift:test
assert(greet("World") == "Hello, World!")
\`\`\`

\`\`\`swift:broken
func greet(_ name: String) -> String {
    return name
}
\`\`\`
`;

  it('extracts language', () => {
    expect(extractCodeFences(BODY).language).toBe('swift');
  });

  it('extracts starter fence', () => {
    expect(extractCodeFences(BODY).starter).toContain('func greet');
    expect(extractCodeFences(BODY).starter).toContain('// TODO');
  });

  it('extracts test fence', () => {
    expect(extractCodeFences(BODY).test).toContain('assert(greet');
  });

  it('extracts broken fence', () => {
    expect(extractCodeFences(BODY).broken).toContain('return name');
  });

  it('returns empty object when no tagged fences present', () => {
    const result = extractCodeFences('No fences here.');
    expect(result.starter).toBeUndefined();
    expect(result.test).toBeUndefined();
    expect(result.broken).toBeUndefined();
  });

  it('handles body with only starter fence', () => {
    const body = `\`\`\`kotlin:starter\nval x = 1\n\`\`\``;
    const result = extractCodeFences(body);
    expect(result.language).toBe('kotlin');
    expect(result.starter).toContain('val x = 1');
    expect(result.test).toBeUndefined();
  });
});

// ── parseMultipleChoice ───────────────────────────────────────────────────────

describe('parseMultipleChoice', () => {
  const SINGLE = `Which of the following is an optional type in Swift?

- [ ] String
- [x] String?
- [ ] Optional
- [ ] Nullable<String>
`;

  it('extracts questionMarkdown', () => {
    const result = parseMultipleChoice(SINGLE);
    expect(result.questionMarkdown).toContain('optional type in Swift');
  });

  it('extracts all four options', () => {
    expect(parseMultipleChoice(SINGLE).options).toHaveLength(4);
  });

  it('assigns sequential IDs', () => {
    const { options } = parseMultipleChoice(SINGLE);
    expect(options[0].id).toBe('opt-0');
    expect(options[3].id).toBe('opt-3');
  });

  it('identifies correct option', () => {
    const { correctOptionIds } = parseMultipleChoice(SINGLE);
    expect(correctOptionIds).toEqual(['opt-1']);
  });

  it('multiSelect is false for single correct answer', () => {
    expect(parseMultipleChoice(SINGLE).multiSelect).toBe(false);
  });

  it('captures option text correctly', () => {
    const { options } = parseMultipleChoice(SINGLE);
    expect(options[1].text).toBe('String?');
  });

  const MULTI = `Select all value types in Swift.

- [x] Int
- [x] String
- [ ] UIViewController
- [x] Bool
`;

  it('detects multiSelect when multiple correct answers', () => {
    expect(parseMultipleChoice(MULTI).multiSelect).toBe(true);
  });

  it('returns all correct IDs for multi-select', () => {
    const { correctOptionIds } = parseMultipleChoice(MULTI);
    expect(correctOptionIds).toEqual(['opt-0', 'opt-1', 'opt-3']);
  });

  it('handles no question text (options start immediately)', () => {
    const noQ = `- [x] Yes\n- [ ] No\n`;
    const result = parseMultipleChoice(noQ);
    expect(result.questionMarkdown).toBe('');
    expect(result.options).toHaveLength(2);
  });
});

// ── parseLessonFile — video blocks ────────────────────────────────────────────

describe('parseLessonFile – video blocks', () => {
  const LESSON = `---
type: lesson
title: Why @State?
level: intermediate
summary: A short concept video before the drills.
---
Local, mutable storage owned by a single view.
---
type: video
url: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: What does @State actually do?
description: Local, mutable storage owned by a single view.
duration: "2 MIN"
poster: https://img.example.com/poster.jpg
---
`;

  it('emits a video block', () => {
    const { blocks } = parseLessonFile(LESSON);
    const videoBlock = blocks.find((b) => b.kind === 'video');
    expect(videoBlock).toBeDefined();
    expect(videoBlock?.video?.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('captures title, description, durationLabel, posterUrl from frontmatter', () => {
    const { blocks } = parseLessonFile(LESSON);
    const videoBlock = blocks.find((b) => b.kind === 'video');
    expect(videoBlock?.video?.title).toBe('What does @State actually do?');
    expect(videoBlock?.video?.description).toBe('Local, mutable storage owned by a single view.');
    expect(videoBlock?.video?.durationLabel).toBe('2 MIN');
    expect(videoBlock?.video?.posterUrl).toBe('https://img.example.com/poster.jpg');
  });

  it('falls back to body text as description when description is omitted', () => {
    const lesson = `---
type: lesson
title: T
level: beginner
summary: s
---
Intro.
---
type: video
url: https://vimeo.com/76979871
---
A short walkthrough that doubles as the description.
`;
    const { blocks } = parseLessonFile(lesson);
    const videoBlock = blocks.find((b) => b.kind === 'video');
    expect(videoBlock?.video?.description).toBe('A short walkthrough that doubles as the description.');
  });

  it('drops a video section that has no url so a clear error can fire later', () => {
    const lesson = `---
type: lesson
title: T
level: beginner
summary: s
---
Intro.
---
type: video
title: Missing URL
---
`;
    const { blocks } = parseLessonFile(lesson);
    expect(blocks.find((b) => b.kind === 'video')).toBeUndefined();
  });

  it('accepts durationLabel as an alias of duration', () => {
    const lesson = `---
type: lesson
title: T
level: beginner
summary: s
---
Intro.
---
type: video
url: https://loom.com/share/abc123
durationLabel: 3 MIN
---
`;
    const { blocks } = parseLessonFile(lesson);
    expect(blocks.find((b) => b.kind === 'video')?.video?.durationLabel).toBe('3 MIN');
  });
});
