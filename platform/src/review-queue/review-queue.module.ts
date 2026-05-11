import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { ReviewQueueService } from './review-queue.service';
import { ReviewQueueController } from './review-queue.controller';

@Module({
  imports: [StateModule, AuthModule],
  controllers: [ReviewQueueController],
  providers: [ReviewQueueService],
  exports: [ReviewQueueService],
})
export class ReviewQueueModule {}
