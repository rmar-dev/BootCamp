'use client';
import type { ExerciseDTO, ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { MultipleChoiceExercise } from './renderers/MultipleChoiceExercise';
import { FillBlankExercise } from './renderers/FillBlankExercise';
import { PredictOutputExercise } from './renderers/PredictOutputExercise';
import { CodeExercise } from './renderers/CodeExercise';
import { CapstoneSubmissionExercise } from './renderers/CapstoneSubmissionExercise';
import { VisualPlaygroundExercise } from './renderers/VisualPlaygroundExercise';

type Props = {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
};

export function ExerciseBlock({ exercise, onAttempt }: Props) {
  switch (exercise.type) {
    case 'multiple_choice':    return <MultipleChoiceExercise      exercise={exercise} onAttempt={onAttempt} />;
    case 'fill_blank':         return <FillBlankExercise           exercise={exercise} onAttempt={onAttempt} />;
    case 'predict_output':     return <PredictOutputExercise       exercise={exercise} onAttempt={onAttempt} />;
    // CodeExercise renders both `code` and `fix_bug` payloads — same UX, only the
    // starter source, file name, and a "buggy" badge differ.
    case 'code':
    case 'fix_bug':            return <CodeExercise                exercise={exercise} onAttempt={onAttempt} />;
    case 'capstone_submission': return <CapstoneSubmissionExercise exercise={exercise} onAttempt={onAttempt} />;
    case 'visual_playground':  return <VisualPlaygroundExercise   exercise={exercise} onAttempt={onAttempt} />;
  }
}
