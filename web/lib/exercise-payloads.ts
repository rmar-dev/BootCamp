export type Language = 'swift' | 'kotlin';

export type CodePayload = {
  type: 'code';
  language: Language;
  starterCode: string;
  testCode: string;
  testEntryPoint: string;
};

export type FixBugPayload = {
  type: 'fix_bug';
  language: Language;
  brokenCode: string;
  testCode: string;
  testEntryPoint: string;
};

export type FillBlankItem = { id: string; expected: string[] };

export type FillBlankPayload = {
  type: 'fill_blank';
  language: Language;
  template: string;
  blanks: FillBlankItem[];
  /**
   * Optional pool of tokens shown to the student as draggable chips.
   * When omitted, the renderer derives the pool from each blank's first
   * expected value. Authors set this explicitly to add distractors.
   */
  tokens?: string[];
};

export type PredictOutputPayload = {
  type: 'predict_output';
  displayedCode: string;
  displayedLanguage: Language;
  expectedOutput: string;
  // Multiple-choice variant. When present (length ≥ 2), the renderer shows
  // pickable Choice cards instead of a free-text textarea. expectedOutput
  // is guaranteed (validated platform-side) to be one of the options.
  options?: string[];
};

export type MultipleChoiceOption = { id: string; text: string };

export type MultipleChoicePayload = {
  type: 'multiple_choice';
  questionMarkdown: string;
  options: MultipleChoiceOption[];
  correctOptionIds: string[];
  multiSelect: boolean;
};

export type CapstoneSubmissionPayload = {
  type: 'capstone_submission';
};

// ── Visual playground ────────────────────────────────────────────────────────
// Config-driven exercise: a `primitive` (button, text, …) is rendered live in
// HTML/CSS, manipulated by a list of `controls` (text input, swatch picker,
// slider, toggle), with the equivalent SwiftUI/Kotlin code generated alongside.

export type PlaygroundPrimitive = 'button';

export type PlaygroundColorOption = {
  /** Stable id used by the control's value. */
  id: string;
  /** CSS colour for the rendered preview. */
  cssColor: string;
  /** SwiftUI / Kotlin code reference (e.g. "amber" → emits `Color.amber`). */
  codeRef: string;
  /** Optional human label for tooltips and a11y. */
  label?: string;
};

export type PlaygroundControl =
  | { kind: 'text';    id: string; label: string; default: string }
  | { kind: 'color';   id: string; label: string; options: PlaygroundColorOption[]; default: string }
  | { kind: 'slider';  id: string; label: string; min: number; max: number; step?: number; unit?: string; default: number }
  | { kind: 'toggle';  id: string; label: string; default: boolean };

export type VisualPlaygroundPayload = {
  type: 'visual_playground';
  language: Language;
  primitive: PlaygroundPrimitive;
  controls: PlaygroundControl[];
  /**
   * Optional bindings that map control ids to fields the preview/code
   * generator know about. Authors can override defaults; the renderer falls
   * back to control id matching when omitted.
   */
  bindings?: Record<string, string>;
};

export type ExercisePayload =
  | CodePayload
  | FixBugPayload
  | FillBlankPayload
  | PredictOutputPayload
  | MultipleChoicePayload
  | CapstoneSubmissionPayload
  | VisualPlaygroundPayload;

export type ExerciseTypeValue = ExercisePayload['type'];

export type ExerciseAttemptStatus = 'unattempted' | 'first_try' | 'eventual';

export type ExerciseDTO = {
  id: string;
  version: number;
  type: ExerciseTypeValue;
  promptMarkdown: string;
  pointsMax: number;
  payload: ExercisePayload;
  attemptStatus: ExerciseAttemptStatus;
  // Author-supplied progressive hints. CodeExercise (used for both `code` and
  // `fix_bug`) reveals one at a time behind a "Hint" affordance. Optional for
  // back-compat with existing test fixtures and preview/version code paths.
  hints?: string[];
  // Most recent submissionPayload for the active student, or null if not yet
  // attempted. Each renderer parses this to pre-populate its inputs. Optional
  // so existing test fixtures and preview/version code paths can omit it.
  lastResponse?: unknown;
};

/**
 * Authored video block. `url` is a canonical URL — the renderer detects the
 * source (YouTube, Vimeo, Loom, direct .mp4, generic iframe) and picks the
 * right embed strategy.
 */
export type VideoBlockData = {
  url: string;
  title?: string;
  description?: string;
  durationLabel?: string;
  posterUrl?: string;
};

export type LessonBlock =
  | { kind: 'explanation'; id: string; markdown: string }
  | { kind: 'exercise'; id: string; exercise: ExerciseDTO }
  | { kind: 'video'; id: string; video: VideoBlockData };

export type Lesson = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: LessonBlock[];
};
