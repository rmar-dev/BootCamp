import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { AssignmentCoreModule } from './assignment-core.module';
import { StudentRepository } from './repositories/student.repository';
import { EnrollmentRepository } from './repositories/enrollment.repository';
import { AttemptRepository } from './repositories/attempt.repository';
import { ExerciseResultRepository } from './repositories/exercise-result.repository';
import { ScoringService } from './services/scoring.service';
import { AttemptService } from './services/attempt.service';
import { ProgressService } from './services/progress.service';

// StudentDifficultyRepository and ExamDifficultyOverrideRepository are NOT
// listed here — they live in AssignmentCoreModule (which this module re-exports
// as part of its `exports`). Consumers that import StateModule transitively
// receive both via the AssignmentCoreModule re-export, which keeps a single
// shared instance across both ContentModule and StateModule.
@Module({
  imports: [ContentModule, AssignmentCoreModule],
  providers: [
    StudentRepository,
    EnrollmentRepository,
    AttemptRepository,
    ExerciseResultRepository,
    ScoringService,
    AttemptService,
    ProgressService,
  ],
  exports: [
    AssignmentCoreModule,
    StudentRepository,
    EnrollmentRepository,
    AttemptRepository,
    ExerciseResultRepository,
    ScoringService,
    AttemptService,
    ProgressService,
  ],
})
export class StateModule {}
