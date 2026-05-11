import { Injectable } from '@nestjs/common';
import { ProgressAggregatorService } from '../progress/progress.service';
import { LessonRepository } from '../content/repositories/lesson.repository';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { LessonInsightService, ExerciseLike, TypeLabel } from '../content/services/lesson-insight.service';

export type TodayPlan = {
  lessonId: string;
  lessonVersion: number;
  trackId: string;
  trackTitle: string;
  title: string;
  position: number;
  estimatedMinutes: number;
  typeLabel: TypeLabel;
  recommendationKind: 'continue' | 'concept_gap' | 'first_timer';
  reasonMessage: string;
  conceptHint: string | null;
};

@Injectable()
export class TodayPlanService {
  constructor(
    private readonly progress: ProgressAggregatorService,
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
    private readonly insight: LessonInsightService,
  ) {}

  async resolve(studentId: string | null, trackId: string | undefined): Promise<TodayPlan | null> {
    const rec = await this.progress.getRecommendation(studentId, trackId);
    if (rec.kind === 'exhausted') return null;

    const lesson = await this.lessons.findByVersionWithBlocks(rec.lesson.id, rec.lesson.version);
    if (!lesson) return null;

    const refs = (lesson.blocks ?? [])
      .filter((b) => b.exerciseId !== null && b.exerciseVersion !== null)
      .map((b) => ({ id: b.exerciseId as string, version: b.exerciseVersion as number }));
    const rows = await Promise.all(refs.map((r) => this.exercises.findByVersion(r.id, r.version)));
    const exercises: ExerciseLike[] = rows
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({ type: e.type }));

    return {
      lessonId: rec.lesson.id,
      lessonVersion: rec.lesson.version,
      trackId: rec.lesson.trackId,
      trackTitle: rec.lesson.trackTitle,
      title: rec.lesson.title,
      position: lesson.position,
      estimatedMinutes: this.insight.estimateMinutes(exercises),
      typeLabel: this.insight.deriveTypeLabel(exercises),
      recommendationKind: rec.kind,
      reasonMessage: rec.reason.message,
      conceptHint: rec.kind === 'concept_gap' ? rec.reason.concept : null,
    };
  }
}
