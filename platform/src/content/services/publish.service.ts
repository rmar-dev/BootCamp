import { Injectable } from '@nestjs/common';
import { TrackRepository } from '../repositories/track.repository';
import { LessonRepository } from '../repositories/lesson.repository';
import { ExerciseRepository } from '../repositories/exercise.repository';

@Injectable()
export class PublishService {
  constructor(
    private readonly tracks: TrackRepository,
    private readonly lessons: LessonRepository,
    private readonly exercises: ExerciseRepository,
  ) {}

  async publishTrack(trackId: string, trackVersion: number): Promise<void> {
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
      const lessonId = track.lessonIds[i];
      const lessonVersion = track.lessonVersions[i];

      const lessonWithBlocks = await this.lessons.findByVersionWithBlocks(
        lessonId,
        lessonVersion,
      );
      if (!lessonWithBlocks) continue;

      for (const block of lessonWithBlocks.blocks) {
        if (
          block.kind === 'exercise' &&
          block.exerciseId &&
          block.exerciseVersion
        ) {
          const ex = await this.exercises.findByVersion(
            block.exerciseId,
            block.exerciseVersion,
          );
          if (ex && ex.publishedAt === null) {
            await this.exercises.publish(
              block.exerciseId,
              block.exerciseVersion,
            );
          }
        }
      }

      if (lessonWithBlocks.publishedAt === null) {
        await this.lessons.publish(lessonId, lessonVersion);
      }
    }

    if (track.publishedAt === null) {
      await this.tracks.publish(trackId, trackVersion);
    }
  }
}
