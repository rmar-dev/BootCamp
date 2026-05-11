import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentCoreModule } from '../state/assignment-core.module';
import { CohortRepository } from '../state/repositories/cohort.repository';
import { SkillTreeRepository } from './skill-tree.repository';
import { CohortTrackAssignmentRepository } from './cohort-track-assignment.repository';
import { SkillTreeService } from './skill-tree.service';
import { SkillTreeInstructorController } from './skill-tree.controller';

// Owns the /api/instructor/skill-tree write surface and the read path used
// by the student-facing TrackController (which reads via the assignment
// repository to substitute Track.lessonIds when the calling student's
// cohort has an active SkillTree).
//
// Provides CohortRepository directly (mirrors how ContentModule already
// provides StudentRepository) so the controller can list cohorts without
// pulling in StateModule and creating a cycle through ContentModule.
@Module({
  imports: [AuthModule, PrismaModule, AssignmentCoreModule],
  controllers: [SkillTreeInstructorController],
  providers: [
    SkillTreeRepository,
    CohortTrackAssignmentRepository,
    SkillTreeService,
    CohortRepository,
  ],
  exports: [
    SkillTreeRepository,
    CohortTrackAssignmentRepository,
    SkillTreeService,
  ],
})
export class SkillTreeModule {}
