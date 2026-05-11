import matter from 'gray-matter';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrackMeta = {
  id: string;
  title: string;
  language: 'swift' | 'kotlin';
  kind: 'placement' | 'fundamentals' | 'capstone';
  description: string;
  lessons: string[];
  starterRepoUrl?: string;
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
  // Optional pool of draggable tokens for fill_blank exercises. When omitted,
  // the renderer derives the pool from the blank answers.
  tokens?: string[];
  // Visual-playground config block (YAML-authored as `playground:` in
  // frontmatter). Passed through verbatim — the platform's zod validator is
  // the source of truth for shape.
  playground?: Record<string, unknown>;
  promptMarkdown: string;
  codeFences: CodeFences;
  multipleChoice?: MultipleChoiceResult;
};

export type VideoMeta = {
  url: string;
  title?: string;
  description?: string;
  durationLabel?: string;
  posterUrl?: string;
};

export type ParsedBlock = {
  kind: 'explanation' | 'exercise' | 'video';
  explanationMarkdown?: string;
  exercise?: ExerciseMeta;
  video?: VideoMeta;
};

export type CohortGate = 'four_week' | 'twelve_week';

export type ParsedLesson = {
  title: string;
  level: string;
  summary: string;
  cohortGate?: CohortGate;
  blocks: ParsedBlock[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A section descriptor returned by the internal split pass.
 */
type RawSection = { frontmatter: string; body: string };

/** Return true if a chunk of text looks like YAML frontmatter (key: value lines). */
function looksLikeFrontmatter(chunk: string): boolean {
  const trimmed = chunk.trim();
  if (!trimmed) return false;
  // At least the first non-empty line must look like `key: value` or `key:`
  const firstLine = trimmed.split('\n')[0].trim();
  return /^\w[\w-]*\s*:/.test(firstLine);
}

/**
 * Split a multi-document markdown file on `---` delimiters into an array of
 * `{ frontmatter, body }` pairs.
 *
 * The format allows sections with no body (two `---` fences with no text
 * between them), so we must detect whether a chunk after splitting is YAML
 * frontmatter or plain body text rather than blindly pairing them.
 */
function splitSections(content: string): RawSection[] {
  // Split on lines that are exactly `---`
  const rawChunks = content.split(/^---$/m);

  const sections: RawSection[] = [];
  let i = 0;

  // Chunks before the first `---` are pre-amble – skip empty ones.
  if (rawChunks[0].trim() === '') i = 1;

  while (i < rawChunks.length) {
    const chunk = rawChunks[i];

    if (!looksLikeFrontmatter(chunk)) {
      // Plain text body without a frontmatter block – skip (shouldn't appear
      // at the root level of a well-formed file, but be safe).
      i += 1;
      continue;
    }

    // chunk is frontmatter; the next chunk might be a body OR another FM.
    const nextChunk = rawChunks[i + 1];

    let body = '';
    let advance = 1;

    if (nextChunk !== undefined && !looksLikeFrontmatter(nextChunk)) {
      // Next chunk is a plain body for this section.
      body = nextChunk;
      advance = 2;
    }
    // else: next chunk is FM of the following section (no body for current).

    sections.push({ frontmatter: chunk, body });
    i += advance;
  }

  return sections;
}

/** Remove code fences whose tag is one of `:starter`, `:test`, `:broken`, `:solution`. */
function stripCodeFences(body: string): string {
  return body
    .replace(/```[\w]*:(?:starter|test|broken|solution)[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a track YAML/Markdown file and return structured metadata.
 */
export function parseTrackFile(content: string): TrackMeta {
  const { data } = matter(content);

  return {
    id: data.id as string,
    title: data.title as string,
    language: data.language as 'swift' | 'kotlin',
    kind: data.kind as 'placement' | 'fundamentals' | 'capstone',
    description: data.description as string,
    lessons: (data.lessons as string[]) ?? [],
    starterRepoUrl: data.starterRepoUrl as string | undefined,
  };
}

/**
 * Parse a multi-section lesson file into lesson metadata and an ordered list
 * of explanation / exercise blocks.
 */
export function parseLessonFile(content: string): ParsedLesson {
  // Normalize CRLF → LF so the downstream regexes (which use `\n` and `^---$`)
  // work the same regardless of how the file was authored on disk.
  // Files committed via git on Windows often roundtrip with CRLF endings.
  const normalized = content.replace(/\r\n/g, '\n');
  const sections = splitSections(normalized);

  if (sections.length === 0) {
    throw new Error('parseLessonFile: file has no sections');
  }

  // First section must be the lesson header (type: lesson).
  // Parse its frontmatter using gray-matter by wrapping it in --- fences.
  const firstFm = matter(`---\n${sections[0].frontmatter}\n---\n`).data;

  if (firstFm.type !== 'lesson') {
    throw new Error(`parseLessonFile: first section must have type: lesson, got "${firstFm.type}"`);
  }

  const lesson: ParsedLesson = {
    title: (firstFm.title as string) ?? '',
    level: (firstFm.level as string) ?? '',
    summary: (firstFm.summary as string) ?? sections[0].body.trim(),
    cohortGate: (firstFm.cohortGate as CohortGate | undefined) ?? undefined,
    blocks: [],
  };

  // If the first (lesson header) section has a markdown body, it becomes
  // the opening explanation block.
  const lessonBody = sections[0].body.trim();
  if (lessonBody) {
    lesson.blocks.push({ kind: 'explanation', explanationMarkdown: lessonBody });
  }

  // Remaining sections become blocks
  for (let i = 1; i < sections.length; i++) {
    const secFm = matter(`---\n${sections[i].frontmatter}\n---\n`).data;
    const body = sections[i].body ?? '';

    if (secFm.type === 'exercise') {
      const fences = extractCodeFences(body);

      const exercise: ExerciseMeta = {
        type: secFm.type as string,
        kind: (secFm.kind as string) ?? '',
        language: secFm.language as string | undefined,
        pointsMax: (secFm.pointsMax as number) ?? 0,
        hints: secFm.hints as string[] | undefined,
        concepts: secFm.concepts as string[] | undefined,
        testEntryPoint: secFm.testEntryPoint as string | undefined,
        expectedOutput: secFm.expectedOutput as string | undefined,
        blanks: secFm.blanks as Record<string, string[]> | undefined,
        tokens: secFm.tokens as string[] | undefined,
        playground: secFm.playground as Record<string, unknown> | undefined,
        promptMarkdown: stripCodeFences(body),
        codeFences: fences,
      };

      // Attach multiple-choice result if the body contains option syntax
      if (/^- \[[ x]\]/m.test(body)) {
        exercise.multipleChoice = parseMultipleChoice(body);
      }

      lesson.blocks.push({ kind: 'exercise', exercise });
    } else if (secFm.type === 'video') {
      // Video sections carry their data in frontmatter. Body is optional and
      // when present is treated as a description, but the explicit
      // `description:` field wins to keep authoring predictable.
      const url = secFm.url as string | undefined;
      if (!url) {
        // Skip silently — validateLesson catches missing fields with a clear error.
        // Pushing a malformed block would just produce a confusing downstream error.
        continue;
      }
      const bodyText = body.trim();
      const video: VideoMeta = {
        url,
        title: secFm.title as string | undefined,
        description: (secFm.description as string | undefined) ?? (bodyText || undefined),
        durationLabel: (secFm.duration as string | undefined) ?? (secFm.durationLabel as string | undefined),
        posterUrl: (secFm.poster as string | undefined) ?? (secFm.posterUrl as string | undefined),
      };
      lesson.blocks.push({ kind: 'video', video });
    } else {
      // Plain markdown body → explanation block (skip empty sections)
      const md = body.trim();
      if (md) {
        lesson.blocks.push({ kind: 'explanation', explanationMarkdown: md });
      }
    }
  }

  return lesson;
}

/**
 * Extract tagged code fences from a markdown body.
 *
 * Supported tags: `:starter`, `:test`, `:broken`
 *
 * Example:
 * ```swift:starter
 * // code here
 * ```
 */
export function extractCodeFences(body: string): CodeFences {
  const fences: CodeFences = {};

  // Match ```<lang>:<tag>\n<content>\n``` — accept both LF and CRLF line endings
  // so the parser works the same whether files were authored on Unix or Windows.
  const pattern = /```([\w]*):(starter|test|broken)\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const lang = match[1];
    const tag = match[2] as 'starter' | 'test' | 'broken';
    // Strip a trailing \r so Windows-authored content doesn't carry it into the captured code.
    const code = match[3].replace(/\r$/, '');

    if (!fences.language && lang) {
      fences.language = lang;
    }
    fences[tag] = code;
  }

  return fences;
}

/**
 * Parse multiple-choice options from a markdown body.
 *
 * Format:
 *   - [x] Correct answer
 *   - [ ] Wrong answer
 *
 * The text before the first option line becomes `questionMarkdown`.
 */
export function parseMultipleChoice(body: string): MultipleChoiceResult {
  const lines = body.split('\n');

  const optionPattern = /^- \[([ x])\] (.+)$/;
  const options: Array<{ id: string; text: string }> = [];
  const correctOptionIds: string[] = [];

  let firstOptionIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = optionPattern.exec(lines[i]);
    if (m) {
      if (firstOptionIndex === -1) firstOptionIndex = i;
      const id = `opt-${options.length}`;
      const isCorrect = m[1] === 'x';
      options.push({ id, text: m[2].trim() });
      if (isCorrect) correctOptionIds.push(id);
    }
  }

  const questionMarkdown =
    firstOptionIndex > 0
      ? lines.slice(0, firstOptionIndex).join('\n').trim()
      : '';

  return {
    questionMarkdown,
    options,
    correctOptionIds,
    multiSelect: correctOptionIds.length > 1,
  };
}
