import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StateModule } from '../state/state.module';
import { ContentModule } from '../content/content.module';
import { HelpModule } from '../help/help.module';
import { SkillTreeModule } from '../skill-tree/skill-tree.module';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { HelpRequestRepository } from '../help/help-request.repository';

// Owns the /api/instructor/students surface (roster + unassigned + assign +
// detail). Pulls difficulty repos via StateModule's transitive
// AssignmentCoreModule re-export, HelpRequestRepository directly so it can
// compose per-student help-request KPIs without exposing a service method
// just for the count, ContentModule for TrackRepository (track titles on the
// detail page), and SkillTreeModule for the per-track active-tree composer.
@Module({
  imports: [AuthModule, PrismaModule, StateModule, ContentModule, HelpModule, SkillTreeModule],
  controllers: [StudentsController],
  providers: [StudentsService, HelpRequestRepository],
  exports: [StudentsService],
})
export class StudentsModule {}
