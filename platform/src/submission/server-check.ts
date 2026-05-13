import { ExercisePayload } from '../content/types/exercise-payload.types';

export function serverCheck(
  payload: ExercisePayload,
  answer: unknown,
): { passed: boolean } {
  switch (payload.type) {
    case 'multiple_choice': {
      const submitted = (answer as string[]).slice().sort();
      const correct = payload.correctOptionIds.slice().sort();
      // Two semantics depending on whether the author marked the exercise
      // multi-select:
      //   multiSelect=true  → student must pick EVERY correct option and no
      //                       others (set-equality).
      //   multiSelect=false → student picks ONE option; pass if it's in the
      //                       set of acceptable correct options. This is the
      //                       "any of these is right" pattern the seed uses
      //                       (e.g. "Which language are you learning?" with
      //                       Swift / Kotlin / Both all marked correct).
      if (payload.multiSelect) {
        const passed =
          submitted.length === correct.length &&
          submitted.every((id, i) => id === correct[i]);
        return { passed };
      }
      const passed = submitted.length === 1 && correct.includes(submitted[0]);
      return { passed };
    }

    case 'fill_blank': {
      const answerMap = answer as Record<string, string>;
      const passed = payload.blanks.every((blank) => {
        const val = answerMap[blank.id];
        return blank.expected.includes(val?.trim());
      });
      return { passed };
    }

    case 'predict_output': {
      const passed =
        String(answer).trim() === payload.expectedOutput.trim();
      return { passed };
    }

    case 'code':
    case 'fix_bug':
      throw new Error('serverCheck does not handle execution types');

    case 'capstone_submission':
      throw new Error('serverCheck does not handle capstone_submission');

    case 'visual_playground':
      // Playgrounds aren't graded — auto-pass. The submission service should
      // never call serverCheck for them, but if it does, this is the safe
      // default (no points, no failure).
      return { passed: true };

    default: {
      const _exhaustive: never = payload;
      throw new Error(`Unknown payload type: ${(_exhaustive as any).type}`);
    }
  }
}
