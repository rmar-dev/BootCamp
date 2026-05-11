import { Injectable } from '@nestjs/common';
import { LessonRepository } from '../../content/repositories/lesson.repository';
import { TrackRepository } from '../../content/repositories/track.repository';
import { ExerciseResultRepository } from '../repositories/exercise-result.repository';

@Injectable()
export class ProgressService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly results: ExerciseResultRepository,
    private readonly tracks: TrackRepository,
  ) {}

  async isLessonCompleted(
    studentId: string,
    lessonId: string,
    lessonVersion: number,
  ): Promise<boolean> {
    const lesson = await this.lessons.findByVersionWithBlocks(
      lessonId,
      lessonVersion,
    );
    if (!lesson) {
      throw new Error(`Lesson ${lessonId} v${lessonVersion} not found`);
    }
    const exerciseBlocks = lesson.blocks.filter((b) => b.kind === 'exercise');
    if (exerciseBlocks.length === 0) {
      return true;
    }
    for (const block of exerciseBlocks) {
      if (!block.exerciseId) continue;
      const result = await this.results.findByStudentAndExercise(
        studentId,
        block.exerciseId,
      );
      if (!result || !result.passed) {
        return false;
      }
    }
    return true;
  }

  async isTrackCompleted(
    studentId: string,
    trackId: string,
    trackVersion: number,
  ): Promise<boolean> {
    const track = await this.tracks.findByVersion(trackId, trackVersion);
    if (!track) {
      throw new Error(`Track ${trackId} v${trackVersion} not found`);
    }
    if (track.lessonIds.length !== track.lessonVersions.length) {
      throw new Error(
        `Track ${trackId} v${trackVersion} has mismatched lessonIds/lessonVersions arrays`,
      );
    }
    for (let i = 0; i < track.lessonIds.length; i++) {
      const done = await this.isLessonCompleted(
        studentId,
        track.lessonIds[i],
        track.lessonVersions[i],
      );
      if (!done) {
        return false;
      }
    }
    return true;
  }
}
