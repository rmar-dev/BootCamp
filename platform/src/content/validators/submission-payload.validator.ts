import { z } from 'zod';
import { ExerciseTypeValue } from '../types/exercise-type.enum';
import { SubmissionPayload } from '../types/submission-payload.types';

const codeSubmissionSchema = z.object({
  type: z.literal('code'),
  code: z.string(),
});

const fixBugSubmissionSchema = z.object({
  type: z.literal('fix_bug'),
  code: z.string(),
});

const fillBlankSubmissionSchema = z.object({
  type: z.literal('fill_blank'),
  blanks: z.record(z.string(), z.string()),
});

const predictOutputSubmissionSchema = z.object({
  type: z.literal('predict_output'),
  answer: z.string(),
});

const multipleChoiceSubmissionSchema = z.object({
  type: z.literal('multiple_choice'),
  selectedOptionIds: z.array(z.string()),
});

const capstoneSubmissionSchema = z.object({
  type: z.literal('capstone_submission'),
  repoUrl: z.string().url(),
  commitSha: z.string().min(7),
  notes: z.string(),
});

const visualPlaygroundSubmissionSchema = z.object({
  type: z.literal('visual_playground'),
  state: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

const schemaByType: Record<ExerciseTypeValue, z.ZodTypeAny> = {
  code: codeSubmissionSchema,
  fix_bug: fixBugSubmissionSchema,
  fill_blank: fillBlankSubmissionSchema,
  predict_output: predictOutputSubmissionSchema,
  multiple_choice: multipleChoiceSubmissionSchema,
  capstone_submission: capstoneSubmissionSchema,
  visual_playground: visualPlaygroundSubmissionSchema,
};

export function parseSubmissionPayload(
  type: ExerciseTypeValue,
  raw: unknown,
): SubmissionPayload {
  return schemaByType[type].parse(raw) as SubmissionPayload;
}
