export const ExerciseTypeValues = [
  'code',
  'fix_bug',
  'fill_blank',
  'predict_output',
  'multiple_choice',
  'capstone_submission',
  'visual_playground',
] as const;

export type ExerciseTypeValue = (typeof ExerciseTypeValues)[number];
