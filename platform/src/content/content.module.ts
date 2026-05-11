import { Module } from '@nestjs/common';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { ExerciseRepository } from './repositories/exercise.repository';
import { PublishService } from './services/publish.service';
import { LessonAssemblerService } from './services/lesson-assembler.service';
import { LessonInsightService } from './services/lesson-insight.service';
import { LessonController } from './lesson.controller';
import { TrackController } from './track.controller';
import { AssignmentCoreModule } from '../state/assignment-core.module';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { EnsureStudentService } from '../submission/ensure-student';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';

@Module({
  imports: [AssignmentCoreModule, SkillTreeModule],
  controllers: [LessonController, TrackController],
  providers: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
    LessonInsightService,
    StudentRepository,
    UserRepository,
    EnsureStudentService,
  ],
  exports: [
    TrackRepository,
    LessonRepository,
    ExerciseRepository,
    PublishService,
    LessonAssemblerService,
    LessonInsightService,
  ],
})
export class ContentModule {}
