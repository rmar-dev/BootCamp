import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContentModule } from './content/content.module';
import { StateModule } from './state/state.module';
import { ExecutionModule } from './execution/execution.module';
import { AuthModule } from './auth/auth.module';
import { SubmissionModule } from './submission/submission.module';
import { GamificationModule } from './gamification/gamification.module';
import { ReviewModule } from './review/review.module';
import { InstructorReviewModule } from './instructor-review/instructor-review.module';
import { InstructorContentModule } from './instructor-content/instructor-content.module';
import { HelpModule } from './help/help.module';
import { RatingsModule } from './ratings/ratings.module';
import { StudentsModule } from './students/students.module';
import { SkillTreeModule } from './skill-tree/skill-tree.module';
import { ProgressModule } from './progress/progress.module';
import { ReviewQueueModule } from './review-queue/review-queue.module';
import { FeedbackModule } from './feedback/feedback.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, ExecutionModule, AuthModule, SubmissionModule, GamificationModule, ReviewModule, InstructorReviewModule, InstructorContentModule, HelpModule, RatingsModule, StudentsModule, SkillTreeModule, ProgressModule, ReviewQueueModule, FeedbackModule, InvitationsModule, AdminModule],
})
export class AppModule {}
