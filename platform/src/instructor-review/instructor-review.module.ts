import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { InstructorReviewRepository } from './instructor-review.repository';
import { InstructorReviewService } from './instructor-review.service';
import { InstructorReviewController } from './instructor-review.controller';

@Module({
  imports: [StateModule, AuthModule],
  controllers: [InstructorReviewController],
  providers: [InstructorReviewRepository, InstructorReviewService],
  exports: [InstructorReviewService],
})
export class InstructorReviewModule {}
