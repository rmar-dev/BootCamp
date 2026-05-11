export type CodeSubmission = {
  type: 'code';
  code: string;
};

export type FixBugSubmission = {
  type: 'fix_bug';
  code: string;
};

export type FillBlankSubmission = {
  type: 'fill_blank';
  blanks: Record<string, string>;
};

export type PredictOutputSubmission = {
  type: 'predict_output';
  answer: string;
};

export type MultipleChoiceSubmission = {
  type: 'multiple_choice';
  selectedOptionIds: string[];
};

export type CapstoneSubmission = {
  type: 'capstone_submission';
  repoUrl: string;
  commitSha: string;
  notes: string;
};

// Visual-playground submissions capture the final value of every control so
// instructors can audit what students explored. Auto-passes — there is no
// "wrong answer" in a playground.
export type VisualPlaygroundSubmission = {
  type: 'visual_playground';
  state: Record<string, string | number | boolean>;
};

export type SubmissionPayload =
  | CodeSubmission
  | FixBugSubmission
  | FillBlankSubmission
  | PredictOutputSubmission
  | MultipleChoiceSubmission
  | CapstoneSubmission
  | VisualPlaygroundSubmission;
