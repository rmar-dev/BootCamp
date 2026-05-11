import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { REVIEW_PROVIDER } from './review-provider.interface';
import { MockProvider } from './providers/mock.provider';
import { OpenAICompatProvider } from './providers/openai-compat.provider';

@Module({
  imports: [StateModule, AuthModule],
  controllers: [ReviewController],
  providers: [
    ReviewRepository,
    ReviewService,
    {
      provide: REVIEW_PROVIDER,
      useFactory: () => {
        const enabled = process.env.AI_REVIEW_ENABLED === 'true';
        const baseUrl = process.env.AI_REVIEW_BASE_URL;
        const apiKey = process.env.AI_REVIEW_API_KEY;
        const model = process.env.AI_REVIEW_MODEL;

        if (enabled && baseUrl && apiKey && model) {
          return new OpenAICompatProvider(baseUrl, apiKey, model);
        }
        return new MockProvider();
      },
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
