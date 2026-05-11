import { z } from 'zod';
import { ExercisePayload } from '../types/exercise-payload.types';
import { ExerciseTypeValue } from '../types/exercise-type.enum';

const languageSchema = z.enum(['swift', 'kotlin']);

const codeSchema = z.object({
  type: z.literal('code'),
  language: languageSchema,
  starterCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fixBugSchema = z.object({
  type: z.literal('fix_bug'),
  language: languageSchema,
  brokenCode: z.string(),
  testCode: z.string(),
  testEntryPoint: z.string().min(1),
});

const fillBlankSchema = z.object({
  type: z.literal('fill_blank'),
  language: languageSchema,
  template: z.string(),
  blanks: z
    .array(
      z.object({
        id: z.string().min(1),
        expected: z.array(z.string()).min(1),
      }),
    )
    .min(1),
  tokens: z.array(z.string().min(1)).min(1).optional(),
});

const predictOutputSchema = z
  .object({
    type: z.literal('predict_output'),
    displayedCode: z.string(),
    displayedLanguage: languageSchema,
    expectedOutput: z.string(),
    options: z.array(z.string()).min(2).optional(),
  })
  .refine(
    (val) => {
      // If multiple-choice options are authored, expectedOutput must be one
      // of them — otherwise the student couldn't ever pick the right answer
      // and the renderer would silently look broken.
      if (!val.options) return true;
      return val.options.includes(val.expectedOutput);
    },
    { message: 'expectedOutput must be one of options when options is set' },
  );

const multipleChoiceSchema = z
  .object({
    type: z.literal('multiple_choice'),
    questionMarkdown: z.string().min(1),
    options: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string(),
        }),
      )
      .min(2),
    correctOptionIds: z.array(z.string()).min(1),
    multiSelect: z.boolean(),
  })
  .refine(
    (val) => {
      const optionIds = new Set(val.options.map((o) => o.id));
      return val.correctOptionIds.every((id) => optionIds.has(id));
    },
    { message: 'correctOptionIds must reference existing option ids' },
  );

const capstoneSubmissionSchema = z.object({
  type: z.literal('capstone_submission'),
});

const playgroundColorOptionSchema = z.object({
  id: z.string().min(1),
  cssColor: z.string().min(1),
  codeRef: z.string().min(1),
  label: z.string().optional(),
});

const playgroundControlSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    id: z.string().min(1),
    label: z.string().min(1),
    default: z.string(),
  }),
  z.object({
    kind: z.literal('color'),
    id: z.string().min(1),
    label: z.string().min(1),
    options: z.array(playgroundColorOptionSchema).min(2),
    default: z.string().min(1),
  }),
  z.object({
    kind: z.literal('slider'),
    id: z.string().min(1),
    label: z.string().min(1),
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    unit: z.string().optional(),
    default: z.number(),
  }),
  z.object({
    kind: z.literal('toggle'),
    id: z.string().min(1),
    label: z.string().min(1),
    default: z.boolean(),
  }),
]);

const visualPlaygroundSchema = z
  .object({
    type: z.literal('visual_playground'),
    language: languageSchema,
    primitive: z.enum(['button']),
    controls: z.array(playgroundControlSchema).min(1),
    bindings: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (val) => {
      // Sliders' default must sit within [min, max]; color defaults must
      // reference an existing option; otherwise the renderer hits an
      // unrenderable initial state at runtime.
      for (const c of val.controls) {
        if (c.kind === 'slider' && (c.default < c.min || c.default > c.max)) return false;
        if (c.kind === 'color' && !c.options.some((o) => o.id === c.default)) return false;
      }
      return true;
    },
    { message: 'control default is out of range or references an unknown option id' },
  );

const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSchema,
  fix_bug: fixBugSchema,
  fill_blank: fillBlankSchema,
  predict_output: predictOutputSchema,
  multiple_choice: multipleChoiceSchema,
  capstone_submission: capstoneSubmissionSchema,
  visual_playground: visualPlaygroundSchema,
};

export function parseExercisePayload(
  type: ExerciseTypeValue,
  raw: unknown,
): ExercisePayload {
  const schema = schemaByType[type];
  return schema.parse(raw) as ExercisePayload;
}
