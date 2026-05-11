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

export type FillBlankItem = {
  id: string;
  expected: string[];
};

export type FillBlankPayload = {
  type: 'fill_blank';
  language: Language;
  template: string;
  blanks: FillBlankItem[];
  // Optional pool of draggable tokens shown beneath the template.
  // Renderer falls back to deriving from blanks[].expected[0] when omitted.
  tokens?: string[];
};

export type PredictOutputPayload = {
  type: 'predict_output';
  displayedCode: string;
  displayedLanguage: Language;
  expectedOutput: string;
  // Optional multiple-choice variant. When `options` is present (length ≥ 2),
  // the renderer shows pickable choice cards instead of a free-text textarea.
  // The student picks one option; submission grades by exact-equality against
  // expectedOutput, same as the typed-answer path. expectedOutput MUST be one
  // of the options when this field is set (validated at parse time).
  // Use this when you want to test the concept (e.g. "Swift wraps Optionals
  // when printed") without testing exact-match typing of the output string.
  options?: string[];
};

export type MultipleChoiceOption = {
  id: string;
  text: string;
};

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
// Config-driven exercise. The web renderer interprets `controls` to build the
// modifier panel, the live preview, and the generated SwiftUI / Kotlin code.

export type PlaygroundPrimitive = 'button';

export type PlaygroundColorOption = {
  id: string;
  cssColor: string;
  codeRef: string;
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
