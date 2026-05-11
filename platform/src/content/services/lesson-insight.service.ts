import { Injectable } from '@nestjs/common';
import { ExerciseType } from '@prisma/client';

export type ExerciseLike = { type: ExerciseType };
export type TypeLabel = 'Concept + quiz' | 'Code + tests' | 'Concept + code' | 'Capstone';

const SECONDS_BY_TYPE: Record<ExerciseType, number> = {
  multiple_choice: 30,
  fill_blank: 60,
  predict_output: 90,
  code: 240,
  fix_bug: 240,
  capstone_submission: 1200,
  // Tweak-driven UI exercise — quick to attempt once the controls are
  // understood. Sit between the quiz tier and the code tier.
  visual_playground: 120,
};

const QUIZ_TYPES = new Set<ExerciseType>(['multiple_choice', 'fill_blank', 'predict_output']);
const CODE_TYPES = new Set<ExerciseType>(['code', 'fix_bug']);

@Injectable()
export class LessonInsightService {
  estimateMinutes(exercises: ExerciseLike[]): number {
    if (exercises.length === 0) return 1;
    const totalSeconds = exercises.reduce((acc, e) => acc + SECONDS_BY_TYPE[e.type], 0);
    return Math.max(1, Math.ceil(totalSeconds / 60));
  }

  deriveTypeLabel(exercises: ExerciseLike[]): TypeLabel {
    if (exercises.length === 0) return 'Concept + quiz';
    if (exercises.some((e) => e.type === 'capstone_submission')) return 'Capstone';
    const hasQuiz = exercises.some((e) => QUIZ_TYPES.has(e.type));
    const hasCode = exercises.some((e) => CODE_TYPES.has(e.type));
    if (hasQuiz && hasCode) return 'Concept + code';
    if (hasCode) return 'Code + tests';
    return 'Concept + quiz';
  }
}
