import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StateModule } from '../state/state.module';
import { HelpRequestRepository } from './help-request.repository';
import { HelpRequestService } from './help-request.service';
import { HelpRequestStudentController } from './help-request-student.controller';
import { HelpRequestInstructorController } from './help-request-instructor.controller';

// Single module owns both the student-facing (POST /api/help-requests) and
// the instructor-facing (GET /api/instructor/help-requests) surface for
// help requests. Splitting into two modules would only fragment the
// service + repo registration without buying anything.
@Module({
  imports: [AuthModule, PrismaModule, StateModule],
  controllers: [HelpRequestStudentController, HelpRequestInstructorController],
  providers: [HelpRequestRepository, HelpRequestService],
  exports: [HelpRequestService],
})
export class HelpModule {}
