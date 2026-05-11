import { Module } from '@nestjs/common';
import { CohortRepository } from './repositories/cohort.repository';
import { LessonAssignmentRepository } from './repositories/lesson-assignment.repository';
import { StudentDifficultyRepository } from './repositories/student-difficulty.repository';
import { ExamDifficultyOverrideRepository } from './repositories/exam-difficulty-override.repository';
import { AssignmentService } from './services/assignment.service';

// Thin shared module that owns the single instances of AssignmentService and
// its repository dependencies. Both ContentModule and StateModule import
// this instead of declaring the providers themselves, which eliminates the
// dual-instance problem caused by NestJS creating one instance per module.
//
// The difficulty repositories live here (not in StateModule) so the
// LessonAssemblerService — which lives in ContentModule — can inject them
// without forcing ContentModule to import StateModule (which would create a
// dependency cycle since StateModule already imports ContentModule).
//
// PrismaService is NOT listed here because PrismaModule is @Global() and
// makes PrismaService available application-wide without re-importing.
@Module({
  providers: [
    CohortRepository,
    LessonAssignmentRepository,
    StudentDifficultyRepository,
    ExamDifficultyOverrideRepository,
    AssignmentService,
  ],
  exports: [
    CohortRepository,
    LessonAssignmentRepository,
    StudentDifficultyRepository,
    ExamDifficultyOverrideRepository,
    AssignmentService,
  ],
})
export class AssignmentCoreModule {}
