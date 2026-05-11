import { z } from 'zod';

const language = z.enum(['swift', 'kotlin']);

const code = z.object({
  type: z.literal('code'),
  language,
  starterCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fixBug = z.object({
  type: z.literal('fix_bug'),
  language,
  brokenCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fillBlank = z.object({
  type: z.literal('fill_blank'),
  language,
  template: z.string(),
  blanks: z
    .array(z.object({ id: z.string().min(1), expected: z.array(z.string()).min(1) }))
    .min(1),
});

const predictOutput = z.object({
  type: z.literal('predict_output'),
  displayedCode: z.string(),
  displayedLanguage: language,
  expectedOutput: z.string(),
});

const multipleChoice = z.object({
  type: z.literal('multiple_choice'),
  questionMarkdown: z.string().min(1),
  options: z
    .array(z.object({ id: z.string().min(1), text: z.string() }))
    .min(2),
  correctOptionIds: z.array(z.string()).min(1),
  multiSelect: z.boolean(),
});

const capstoneSubmission = z.object({
  type: z.literal('capstone_submission'),
});

export const exercisePayloadSchema = z.discriminatedUnion('type', [
  code, fixBug, fillBlank, predictOutput, multipleChoice, capstoneSubmission,
]);

export const exerciseDtoSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  type: z.enum(['code', 'fix_bug', 'fill_blank', 'predict_output', 'multiple_choice', 'capstone_submission']),
  promptMarkdown: z.string(),
  pointsMax: z.number().int(),
  payload: exercisePayloadSchema,
  attemptStatus: z.enum(['unattempted', 'first_try', 'eventual']),
  lastResponse: z.unknown().nullable().optional(),
});

export const lessonBlockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('explanation'), id: z.string().min(1), markdown: z.string() }),
  z.object({ kind: z.literal('exercise'), id: z.string().min(1), exercise: exerciseDtoSchema }),
]);

export const lessonSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string(),
  trackId: z.string().nullable(),
  blocks: z.array(lessonBlockSchema),
});
