import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { ExecutionModule } from '../execution/execution.module';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ReviewModule } from '../review/review.module';
import { ReviewQueueModule } from '../review-queue/review-queue.module';
import { SubmitController } from './submit.controller';
import { ProgressController } from './progress.controller';
import { SubmissionService } from './submission.service';
import { EnsureStudentService } from './ensure-student';

@Module({
  imports: [ContentModule, ExecutionModule, StateModule, AuthModule, GamificationModule, ReviewModule, ReviewQueueModule],
  controllers: [SubmitController, ProgressController],
  providers: [SubmissionService, EnsureStudentService],
})
export class SubmissionModule {}
