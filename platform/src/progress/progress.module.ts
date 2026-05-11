import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentModule } from '../content/content.module';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { ProgressAggregatorService } from './progress.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, AuthModule],
  controllers: [ProgressController],
  providers: [ProgressAggregatorService],
  exports: [ProgressAggregatorService],
})
export class ProgressModule {}
