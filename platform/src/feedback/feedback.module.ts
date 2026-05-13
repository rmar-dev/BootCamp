import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { EnsureStudentService } from '../submission/ensure-student';
import { FeedbackRepository } from './feedback.repository';
import { FeedbackService } from './feedback.service';
import { FeedbackStudentController } from './feedback-student.controller';
import { FeedbackInstructorController } from './feedback-instructor.controller';

// Single module owns both the student-facing (POST /api/feedback) and the
// instructor-facing (GET /api/instructor/feedback) surface.
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FeedbackStudentController, FeedbackInstructorController],
  providers: [
    FeedbackRepository,
    FeedbackService,
    StudentRepository,
    UserRepository,
    EnsureStudentService,
  ],
  exports: [FeedbackService],
})
export class FeedbackModule {}
